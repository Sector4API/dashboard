import { NextResponse } from 'next/server';
import { dashboardAdminSupabase } from '@/lib/supabase';

interface RouteContext {
  params: { id: string };
}

interface UpdateUserBody {
  name?: string;
  organization_name?: string;
  phone_number?: string;
  address?: string;
  subscription_status?: 'preview' | 'premium';
  subscription_expires_at?: string | null;
  organization_logo?: string;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = context.params;
    if (!id) {
      // console.error('Missing user ID in request');
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const body = await request.json() as UpdateUserBody;
    // console.log('Received update request for user:', id, 'with body:', body);
    
    const {
      name,
      organization_name,
      phone_number,
      address,
      subscription_status,
      subscription_expires_at,
      organization_logo
    } = body;

    const updateData: UpdateUserBody = {};
    if (name !== undefined) updateData.name = name;
    if (organization_name !== undefined) updateData.organization_name = organization_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (subscription_status !== undefined) {
      // Validate subscription status against exact database constraint values
      if (subscription_status !== 'preview' && subscription_status !== 'premium') {
        // console.error('Invalid subscription status:', subscription_status);
        return NextResponse.json(
          { 
            error: 'Invalid subscription status. Must be exactly "preview" or "premium".',
            received: subscription_status,
            validOptions: ['preview', 'premium']
          },
          { status: 400 }
        );
      }
      updateData.subscription_status = subscription_status;
    }
    if (subscription_expires_at !== undefined) {
      updateData.subscription_expires_at = subscription_expires_at || null;
    }
    if (organization_logo !== undefined) updateData.organization_logo = organization_logo;

    // console.log('Updating user with data:', updateData);

    // First check if the user exists
    const { data: existingUser, error: checkError } = await dashboardAdminSupabase
      .from('user_details')
      .select('id, subscription_status')
      .eq('id', id)
      .single();

    if (checkError) {
      // console.error('Error checking user existence:', checkError);
      return NextResponse.json({ error: 'Error checking user existence' }, { status: 500 });
    }

    if (!existingUser) {
      // console.error('User not found:', id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // console.log('Current user subscription status:', existingUser.subscription_status);

    // Perform the update
    const { data, error } = await dashboardAdminSupabase
      .from('user_details')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // console.error('Error updating user in database:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      // console.error('No data returned after update');
      return NextResponse.json(
        { error: 'No data returned after update' },
        { status: 500 }
      );
    }

    // console.log('Successfully updated user. Response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    // console.error('Error in PATCH /api/users/[id]:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `Server error: ${error.message}` 
          : 'Unknown server error',
        details: error
      },
      { status: 500 }
    );
  }
} 