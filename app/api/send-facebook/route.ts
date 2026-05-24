import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, page_id, access_token } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!page_id || !access_token) {
      return NextResponse.json({ error: 'Page ID and access token are required' }, { status: 400 });
    }

    // Post to Facebook Page
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${page_id}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          access_token,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        { error: 'Failed to post to Facebook', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Facebook post created successfully',
      data 
    });
  } catch (error) {
    console.error('Facebook API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
