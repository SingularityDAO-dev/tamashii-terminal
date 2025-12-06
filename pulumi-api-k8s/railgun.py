import pulumi
from pulumi_kubernetes.apps.v1 import Deployment
from pulumi_kubernetes.core.v1 import Service, Secret, ConfigMap, PersistentVolumeClaim
import base64
import json


def create_railgun_deployment(
    stack_name: str,
    slug: str,
    namespace_name: str,
    k8s_provider,
    registry_url: pulumi.Output[str],
    registry_username: pulumi.Output[str],
    registry_password: pulumi.Output[str],
    registry_tag: str,
    mnemonic: pulumi.Output[str],
    encryption_key: pulumi.Output[str],
    rpc_url: pulumi.Output[str],
    network_name: str,
    cpu_request: str = "500m",
):
    """Create a Kubernetes deployment for the Railgun payment backend service."""

    port = 3000  # Node.js/Express port

    # Create Docker registry secret
    docker_registry_secret = Secret(
        f"{slug}-docker-registry-secret",
        metadata={
            "name": f"{slug}-docker-registry-secret",
            "namespace": namespace_name,
        },
        type="kubernetes.io/dockerconfigjson",
        data={
            ".dockerconfigjson": pulumi.Output.all(registry_url, registry_username, registry_password).apply(
                lambda args: base64.b64encode(
                    json.dumps({
                        "auths": {
                            args[0]: {
                                "username": args[1],
                                "password": args[2],
                                "auth": base64.b64encode(f"{args[1]}:{args[2]}".encode()).decode()
                            }
                        }
                    }).encode()
                ).decode()
            )
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create app secrets (mnemonic for wallet, encryption key, rpc url)
    app_secrets = Secret(
        f"{slug}-app-secrets",
        metadata={
            "name": f"{slug}-app-secrets",
            "namespace": namespace_name,
        },
        string_data={
            "MNEMONIC": mnemonic,
            "ENCRYPTION_KEY": encryption_key,
            "RPC_URL": rpc_url,
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create ConfigMap
    app_config = ConfigMap(
        f"{slug}-app-config",
        metadata={
            "name": f"{slug}-app-config",
            "namespace": namespace_name,
        },
        data={
            "PORT": str(port),
            "DB_DIR": "/data/db",
            "ARTIFACT_DIR": "/data/artifacts",
            "NETWORK_NAME": network_name,
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create PVC for persistent data (leveldb, artifacts)
    pvc = PersistentVolumeClaim(
        f"{slug}-data-pvc",
        metadata={
            "name": f"{slug}-data-pvc",
            "namespace": namespace_name,
        },
        spec={
            "accessModes": ["ReadWriteOnce"],
            "resources": {
                "requests": {
                    "storage": "10Gi"
                }
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create Deployment
    deployment = Deployment(
        f"{slug}-deployment",
        metadata={
            "name": f"{slug}-deployment",
            "namespace": namespace_name,
        },
        spec={
            "replicas": 1,
            "selector": {"matchLabels": {"app": f"{slug}"}},
            "template": {
                "metadata": {"labels": {"app": f"{slug}"}},
                "spec": {
                    "securityContext": {
                        "fsGroup": 1000,
                        "runAsUser": 1000,
                        "runAsGroup": 1000
                    },
                    "containers": [
                        {
                            "name": "railgun",
                            "image": pulumi.Output.all(registry_url, registry_tag).apply(
                                lambda args: f"{args[0]}/railgun:{args[1]}"
                            ),
                            "ports": [{"containerPort": port}],
                            "envFrom": [
                                {"configMapRef": {"name": app_config.metadata["name"]}},
                                {"secretRef": {"name": app_secrets.metadata["name"]}},
                            ],
                            "volumeMounts": [
                                {
                                    "name": "data",
                                    "mountPath": "/data"
                                }
                            ],
                            "imagePullPolicy": "Always",
                            "resources": {
                                "limits": {"cpu": cpu_request, "memory": "2Gi"},
                                "requests": {"cpu": cpu_request, "memory": "512Mi"}
                            },
                            "readinessProbe": {
                                "httpGet": {
                                    "path": "/health",
                                    "port": port
                                },
                                "initialDelaySeconds": 30,
                                "periodSeconds": 10
                            },
                            "livenessProbe": {
                                "httpGet": {
                                    "path": "/health",
                                    "port": port
                                },
                                "initialDelaySeconds": 60,
                                "periodSeconds": 30
                            }
                        }
                    ],
                    "volumes": [
                        {
                            "name": "data",
                            "persistentVolumeClaim": {
                                "claimName": pvc.metadata["name"]
                            }
                        }
                    ],
                    "imagePullSecrets": [{"name": docker_registry_secret.metadata["name"]}]
                }
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider, depends_on=[docker_registry_secret, app_secrets, app_config, pvc])
    )

    # Create Service
    service = Service(
        f"{slug}-svc",
        metadata={
            "name": f"{slug}-svc",
            "namespace": namespace_name,
        },
        spec={
            "selector": {"app": f"{slug}"},
            "ports": [
                {"name": "http", "port": port, "targetPort": port}
            ]
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider, depends_on=[deployment])
    )

    return deployment, service, port
