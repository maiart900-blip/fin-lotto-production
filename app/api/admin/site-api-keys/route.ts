import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createSiteApiKey, listSiteApiKeys, revokeSiteApiKey } from '@/lib/site-api-auth';

/**
 * Site API Keys Management
 * 
 * GET /api/admin/site-api-keys - List all site API keys
 * POST /api/admin/site-api-keys - Create a new site API key
 * DELETE /api/admin/site-api-keys - Revoke a site API key
 */

export async function GET() {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const result = await listSiteApiKeys();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ keys: result.keys });

  } catch (error) {
    console.error('List site API keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await request.json();

    if (!body.site_id || !body.site_name || !body.site_type) {
      return NextResponse.json(
        { error: 'Missing required fields: site_id, site_name, site_type' },
        { status: 400 }
      );
    }

    if (!['child_auto', 'external_partner'].includes(body.site_type)) {
      return NextResponse.json(
        { error: 'site_type must be "child_auto" or "external_partner"' },
        { status: 400 }
      );
    }

    const result = await createSiteApiKey({
      site_id: body.site_id,
      site_name: body.site_name,
      site_type: body.site_type,
      contact_email: body.contact_email,
      webhook_url: body.webhook_url,
      created_by: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'API key created successfully. Save this key - it cannot be retrieved later.',
      api_key: result.key,
      site_id: body.site_id,
    });

  } catch (error) {
    console.error('Create site API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await request.json();

    if (!body.site_id) {
      return NextResponse.json(
        { error: 'Missing required field: site_id' },
        { status: 400 }
      );
    }

    const result = await revokeSiteApiKey({
      site_id: body.site_id,
      revoked_by: session.user.id,
      reason: body.reason || 'Revoked by admin',
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `API key for site "${body.site_id}" has been revoked`,
    });

  } catch (error) {
    console.error('Revoke site API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}