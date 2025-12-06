import pulumi
from pulumi_kubernetes.apiextensions import CustomResource


def create_ingress(
    base_slug: str,
    namespace_name: str,
    k8s_provider,
    hostname: str,
    domain: str,
    tls_secret_name: str,
    backend_service,
    backend_service_port: int,
    railgun_service,
    railgun_service_port: int,
    backend_api_key: str,
    cors_allowed_origins=None
):
    """Create Traefik IngressRoute for Tamashii API with CORS and path-based routing.

    Args:
        base_slug: Resource name prefix
        namespace_name: Kubernetes namespace
        k8s_provider: Kubernetes provider
        hostname: Service hostname
        domain: Service domain
        tls_secret_name: Name of the TLS secret to use
        backend_service: Backend service object (FastAPI billing)
        backend_service_port: Port the backend service listens on
        railgun_service: Railgun service object (payment backend)
        railgun_service_port: Port the railgun service listens on
        cors_allowed_origins: Optional list of allowed CORS origins (defaults to ["*"])
    """
    full_domain = f"{hostname}.{domain}"

    # Default CORS origins to wildcard if not specified
    if cors_allowed_origins is None:
        cors_allowed_origins = ["*"]

    # Create CORS middleware
    cors_middleware = CustomResource(
        f"{base_slug}-cors-middleware",
        api_version="traefik.containo.us/v1alpha1",
        kind="Middleware",
        metadata={
            "name": f"{base_slug}-cors-middleware",
            "namespace": namespace_name,
        },
        spec={
            "headers": {
                "accessControlAllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "accessControlAllowOriginList": cors_allowed_origins,
                "accessControlAllowCredentials": True,
                "accessControlAllowHeaders": [
                    "Origin",
                    "Content-Type",
                    "Accept",
                    "Authorization",
                    "X-Requested-With",
                ],
                "accessControlExposeHeaders": [
                    "Content-Type",
                ],
                "accessControlMaxAge": 3600,
                "addVaryHeader": True,
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create StripPrefix middleware for railgun (service expects /*, not /railgun/*)
    railgun_strip_prefix = CustomResource(
        f"{base_slug}-railgun-strip-prefix",
        api_version="traefik.containo.us/v1alpha1",
        kind="Middleware",
        metadata={
            "name": f"{base_slug}-railgun-strip-prefix",
            "namespace": namespace_name,
        },
        spec={
            "stripPrefix": {
                "prefixes": ["/railgun"]
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Create API key middleware for railgun
    railgun_api_key_middleware = CustomResource(
        f"{base_slug}-railgun-api-key-middleware",
        api_version="traefik.containo.us/v1alpha1",
        kind="Middleware",
        metadata={
            "name": f"{base_slug}-railgun-api-key-middleware",
            "namespace": namespace_name,
        },
        spec={
            "plugin": {
                "traefik-api-key-auth": {
                    "authenticationHeader": True,
                    "authenticationHeaderName": "X-BACKEND-API-KEY",
                    "bearerHeader": False,
                    "queryParam": False,
                    "pathSegment": False,
                    "removeHeadersOnSuccess": True,
                    "keys": [backend_api_key]
                }
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    # Build routes list
    routes = [
        # Backend routes (/api/*)
        {
            "match": f"Host(`{full_domain}`) && PathPrefix(`/api`)",
            "kind": "Rule",
            "services": [{
                "name": backend_service.metadata["name"],
                "port": backend_service_port
            }],
            "middlewares": [
                {"name": cors_middleware.metadata["name"]}
            ]
        },
        # Backend docs routes (Swagger UI, ReDoc, OpenAPI schema)
        {
            "match": f"Host(`{full_domain}`) && (PathPrefix(`/docs`) || PathPrefix(`/redoc`) || Path(`/openapi.json`))",
            "kind": "Rule",
            "services": [{
                "name": backend_service.metadata["name"],
                "port": backend_service_port
            }],
            "middlewares": [
                {"name": cors_middleware.metadata["name"]}
            ]
        },
        # Railgun routes (/railgun/*) - protected by API key
        {
            "match": f"Host(`{full_domain}`) && PathPrefix(`/railgun`)",
            "kind": "Rule",
            "services": [{
                "name": railgun_service.metadata["name"],
                "port": railgun_service_port
            }],
            "middlewares": [
                {"name": railgun_strip_prefix.metadata["name"]},
                {"name": railgun_api_key_middleware.metadata["name"]},
                {"name": cors_middleware.metadata["name"]}
            ]
        },
    ]

    # Create IngressRoute with path-based routing
    ingressroute = CustomResource(
        f"{base_slug}-ingressroute",
        api_version="traefik.containo.us/v1alpha1",
        kind="IngressRoute",
        metadata={
            "name": f"{base_slug}-ingressroute",
            "namespace": namespace_name,
        },
        spec={
            "entryPoints": ["websecure"],
            "routes": routes,
            "tls": {
                "secretName": tls_secret_name
            }
        },
        opts=pulumi.ResourceOptions(provider=k8s_provider)
    )

    return ingressroute
