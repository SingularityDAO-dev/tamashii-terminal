import pulumi
from pulumi_kubernetes.core.v1 import Namespace, Secret
from pulumi_kubernetes import Provider
from pulumi_tls import PrivateKey
from pulumi_random import RandomString
import pulumi_cloudflare as cloudflare
import backend
import railgun
import traefik
import dns

# Configuration
config = pulumi.Config()
stack_name = pulumi.get_stack()
base_slug = f"{stack_name}-tamashii"

# Domain configuration
hostname = config.require("hostname")

# CORS allowed origins configuration
cors_allowed_origins = config.get_object("cors_allowed_origins")
if cors_allowed_origins is None:
    cors_allowed_origins = ["*"]

# Infrastructure references
config_stack = config.require("config_stack")
traefik_stack = config.require("traefik_stack")
docker_stack = config.require("docker_stack")
db_stack = config.require("db_stack")
psql_stack = config.require("psql_stack")

# Get shared configuration from config stack
config_stack_ref = pulumi.StackReference(config_stack)
kubeconfig = config_stack_ref.require_output("kubeconfig")
domain = config_stack_ref.require_output("domain")
tls_cert = config_stack_ref.require_output("tls_cert")
tls_key = config_stack_ref.require_output("tls_key")
cf_api_token = config_stack_ref.require_output("cloudflare_api_token")
cf_zone_id = config_stack_ref.require_output("cloudflare_zone_id")

# Get stack references
traefik_stack_ref = pulumi.StackReference(traefik_stack)
docker_stack_ref = pulumi.StackReference(docker_stack)
db_stack_ref = pulumi.StackReference(db_stack)
psql_stack_ref = pulumi.StackReference(psql_stack)

# Get traefik IPs for DNS
traefik_ips = traefik_stack_ref.require_output("traefik_external_ips").apply(
    lambda ips: ips.split(",") if isinstance(ips, str) else ips
)

# Create Cloudflare provider
cf_provider = cloudflare.Provider('cloudflare', api_token=cf_api_token)

# Get registry configuration
registry_url = docker_stack_ref.require_output("registry_url")
registry_username = docker_stack_ref.require_output("pull_username")
registry_password = docker_stack_ref.require_output("pull_password")
registry_tag = config.require("registry_tag")

# Check if we should use service DNS for internal communication
use_service_dns = config.require_bool("use_service_dns")

# Get database configuration from stack references
if use_service_dns:
    db_host = psql_stack_ref.require_output("service_dns_name")
    db_port = psql_stack_ref.require_output("service_port").apply(lambda p: str(int(p)))
    db_sslmode = "disable"
else:
    db_host = psql_stack_ref.require_output("dns_hostname")
    db_port = psql_stack_ref.require_output("port").apply(lambda p: str(int(p)))
    db_sslmode = "require"

# Get database credentials from db stack
users = db_stack_ref.require_output("users")
databases = db_stack_ref.require_output("databases")

# Get backend database credentials
backend_db_user = users.apply(lambda u: u["tamashii_user"]["username"])
backend_db_password = users.apply(lambda u: u["tamashii_user"]["password"])
backend_db_name = databases.apply(lambda d: d["tamashii"]["database_name"])

# Get secrets from config
c3_api_key = config.require_secret("c3_api_key")
railgun_mnemonic = config.require_secret("railgun_mnemonic")
railgun_encryption_key = config.require_secret("railgun_encryption_key")
railgun_rpc_url = config.require_secret("railgun_rpc_url")
railgun_network_name = config.require("railgun_network_name")
billing_enabled = config.get("billing_enabled") or "true"

# Generate backend API key using pulumi_random
backend_api_key_random = RandomString(
    f"{base_slug}-backend-api-key",
    length=32,
    special=False,
    upper=True,
    lower=True,
    number=True
)
backend_api_key = pulumi.Output.secret(
    pulumi.Output.concat("tamashii_", stack_name, "_", backend_api_key_random.result)
)

# Create k8s provider
k8s_provider = Provider(f"{base_slug}-k8s-provider", kubeconfig=kubeconfig)

# Create namespace
namespace = Namespace(
    f"{base_slug}-namespace",
    metadata={"name": base_slug},
    opts=pulumi.ResourceOptions(provider=k8s_provider)
)

# Create TLS secret
tls_secret = Secret(
    f"{base_slug}-tls",
    metadata={
        "name": f"{base_slug}-traefik-tls",
        "namespace": namespace.metadata["name"]
    },
    type="kubernetes.io/tls",
    string_data={
        "tls.crt": tls_cert,
        "tls.key": tls_key
    },
    opts=pulumi.ResourceOptions(provider=k8s_provider)
)

# Generate JWT keys for backend service using pulumi_tls (ECDSA P-256 for ES256)
jwt_private_key_resource = PrivateKey(
    f"{base_slug}-jwt-private-key",
    algorithm="ECDSA",
    ecdsa_curve="P256"
)


def pem_to_hex(private_pem: str, public_pem: str) -> tuple[str, str]:
    """Convert PEM keys to hex format for ES256 JWT."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend

    # Load private key
    private_key = serialization.load_pem_private_key(
        private_pem.encode(), password=None, backend=default_backend()
    )

    # Get raw private key bytes (32 bytes for P-256)
    private_numbers = private_key.private_numbers()
    private_bytes = private_numbers.private_value.to_bytes(32, byteorder='big')
    private_hex = private_bytes.hex()

    # Get raw public key bytes (uncompressed: 04 + x + y = 65 bytes)
    public_key = private_key.public_key()
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    public_hex = public_bytes.hex()

    return (private_hex, public_hex)


jwt_keys_hex = pulumi.Output.all(
    jwt_private_key_resource.private_key_pem,
    jwt_private_key_resource.public_key_pem
).apply(lambda args: pem_to_hex(args[0], args[1]))

jwt_private_key_hex = jwt_keys_hex.apply(lambda keys: keys[0])
jwt_public_key_hex = jwt_keys_hex.apply(lambda keys: keys[1])

# Deploy railgun service first (backend depends on it)
railgun_deployment, railgun_service, railgun_port = railgun.create_railgun_deployment(
    stack_name=stack_name,
    slug=f"{base_slug}-railgun",
    namespace_name=namespace.metadata["name"],
    k8s_provider=k8s_provider,
    registry_url=registry_url,
    registry_username=registry_username,
    registry_password=registry_password,
    registry_tag=registry_tag,
    mnemonic=railgun_mnemonic,
    encryption_key=railgun_encryption_key,
    rpc_url=railgun_rpc_url,
    network_name=railgun_network_name,
)

# Compute railgun URL for backend
if use_service_dns:
    railgun_url = pulumi.Output.concat(
        "http://", railgun_service.metadata["name"], ".",
        namespace.metadata["name"], ".svc.cluster.local:",
        str(railgun_port)
    )
else:
    railgun_url = domain.apply(lambda d: f"https://{hostname}.{d}/railgun")

# Deploy backend service
backend_deployment, backend_service, backend_port = backend.create_backend_deployment(
    stack_name=stack_name,
    slug=f"{base_slug}-backend",
    namespace_name=namespace.metadata["name"],
    k8s_provider=k8s_provider,
    registry_url=registry_url,
    registry_username=registry_username,
    registry_password=registry_password,
    registry_tag=registry_tag,
    jwt_private_key=pulumi.Output.secret(jwt_private_key_hex),
    jwt_public_key=pulumi.Output.secret(jwt_public_key_hex),
    db_host=db_host,
    db_port=db_port,
    db_user=backend_db_user,
    db_name=backend_db_name,
    db_password=backend_db_password,
    db_sslmode=db_sslmode,
    c3_api_key=c3_api_key,
    railgun_url=railgun_url,
    backend_api_key=backend_api_key,
    billing_enabled=billing_enabled,
)

# Create ingress
ingressroute = domain.apply(lambda d: traefik.create_ingress(
    base_slug=base_slug,
    namespace_name=namespace.metadata["name"],
    k8s_provider=k8s_provider,
    hostname=hostname,
    domain=d,
    tls_secret_name=tls_secret.metadata["name"],
    backend_service=backend_service,
    backend_service_port=backend_port,
    railgun_service=railgun_service,
    railgun_service_port=railgun_port,
    backend_api_key=backend_api_key,
    cors_allowed_origins=cors_allowed_origins,
))

# Create DNS records
dns_records = traefik_ips.apply(
    lambda ips: [
        dns.create_dns_record(
            slug=base_slug,
            cf_provider=cf_provider,
            zone_id=cf_zone_id,
            hostname=hostname,
            ip=ip,
            index=i
        )
        for i, ip in enumerate(ips)
    ]
)

# Export outputs
pulumi.export("namespace", namespace.metadata["name"])
pulumi.export("backend_deployment_name", backend_deployment.metadata["name"])
pulumi.export("backend_service_name", backend_service.metadata["name"])
pulumi.export("railgun_deployment_name", railgun_deployment.metadata["name"])
pulumi.export("railgun_service_name", railgun_service.metadata["name"])
pulumi.export("ingress_name", ingressroute.metadata["name"])
pulumi.export("tls_secret_name", tls_secret.metadata["name"])

# Export URLs
pulumi.export("backend_url", domain.apply(lambda d: f"https://{hostname}.{d}/api"))
pulumi.export("railgun_url", domain.apply(lambda d: f"https://{hostname}.{d}/railgun"))
pulumi.export("docs_url", domain.apply(lambda d: f"https://{hostname}.{d}/docs"))

# Export internal service DNS names
pulumi.export("backend_service_dns", pulumi.Output.concat(
    backend_service.metadata["name"], ".", namespace.metadata["name"], ".svc.cluster.local"
))
pulumi.export("backend_service_port", backend_port)
pulumi.export("railgun_service_dns", pulumi.Output.concat(
    railgun_service.metadata["name"], ".", namespace.metadata["name"], ".svc.cluster.local"
))
pulumi.export("railgun_service_port", railgun_port)

pulumi.export("hostname", hostname)
pulumi.export("domain", domain)
pulumi.export("backend_api_key", backend_api_key)
