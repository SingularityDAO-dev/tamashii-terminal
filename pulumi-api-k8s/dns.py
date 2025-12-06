import pulumi
import pulumi_cloudflare as cloudflare

def create_dns_record(
    slug: str,
    cf_provider,
    zone_id: str,
    hostname: str,
    ip: str,
    index: int
):
    """Create a single Cloudflare DNS record.

    Args:
        slug: Resource name prefix
        cf_provider: Cloudflare provider instance
        zone_id: Cloudflare zone ID
        hostname: DNS hostname
        ip: IP address for the A record
        index: Index for resource naming
    """
    return cloudflare.DnsRecord(
        f"{slug}-dns-{index}",
        zone_id=zone_id,
        name=hostname,
        type="A",
        content=ip,
        proxied=True,
        ttl=1,  # TTL is automatic when proxied=True
        opts=pulumi.ResourceOptions(provider=cf_provider)
    )
