import pulumi
from pulumi_kubernetes.apps.v1 import Deployment
from pulumi_kubernetes.core.v1 import Service, Secret, ConfigMap
import base64
import json


def create_backend_deployment(
    stack_name: str,
    slug: str,
    namespace_name: str,
    k8s_provider,
    registry_url: pulumi.Output[str],
    registry_username: pulumi.Output[str],
    registry_password: pulumi.Output[str],
    registry_tag: str,
    jwt_private_key: pulumi.Output[str],
    jwt_public_key: pulumi.Output[str],
    db_host,
    db_port,
    db_user,
    db_name,
    db_password: pulumi.Output[str],
    db_sslmode: str,
    c3_api_key: pulumi.Output[str],
    railgun_url: pulumi.Output[str],
    backend_api_key: pulumi.Output[str],
    billing_enabled: str = "true",
    prefix: str = "/api",
    cpu_request: str = "500m",
):
    """Create a Kubernetes deployment for the Tamashii Backend service."""

    port = 8000  # FastAPI/uvicorn port

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

    # Create app secrets
    app_secrets = Secret(
        f"{slug}-app-secrets",
        metadata={
            "name": f"{slug}-app-secrets",
            "namespace": namespace_name,
        },
        string_data={
            "JWT_PRIVATE_KEY": jwt_private_key,
            "JWT_PUBLIC_KEY": jwt_public_key,
            "DB_PASSWORD": db_password,
            "C3_API_KEY": c3_api_key,
            "BACKEND_API_KEY": backend_api_key,
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
            "DB_HOST": db_host,
            "DB_PORT": db_port,
            "DB_USER": db_user,
            "DB_NAME": db_name,
            "DB_SSLMODE": db_sslmode,
            "RAILGUN_URL": railgun_url,
            "PREFIX": prefix,
            "BILLING_ENABLED": billing_enabled,
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
                            "name": "backend",
                            "image": pulumi.Output.all(registry_url, registry_tag).apply(
                                lambda args: f"{args[0]}/backend:{args[1]}"
                            ),
                            "ports": [{"containerPort": port}],
                            "envFrom": [
                                {"configMapRef": {"name": app_config.metadata["name"]}},
                                {"secretRef": {"name": app_secrets.metadata["name"]}},
                            ],
                            "imagePullPolicy": "Always",
                            "resources": {
                                "limits": {"cpu": cpu_request, "memory": "2Gi"},
                                "requests": {"cpu": cpu_request, "memory": "512Mi"}
                            },
                            "readinessProbe": {
                                "httpGet": {
                                    "path": f"{prefix}/health",
                                    "port": port
                                },
                                "initialDelaySeconds": 5,
                                "periodSeconds": 10
                            },
                            "livenessProbe": {
                                "httpGet": {
                                    "path": f"{prefix}/health",
                                    "port": port
                                },
                                "initialDelaySeconds": 30,
                                "periodSeconds": 30
                            }
                        }
                    ],
                    "imagePullSecrets": [{"name": docker_registry_secret.metadata["name"]}]
                }
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider, depends_on=[docker_registry_secret, app_secrets, app_config])
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
