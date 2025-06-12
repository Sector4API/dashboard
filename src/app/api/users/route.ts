import { NextResponse } from 'next/server';
import { dashboardAdminSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';

    let query = dashboardAdminSupabase
      .from('user_details')
      .select(`
        id,
        name,
        organization_name,
        email,
        phone_number,
        address,
        subscription_status,
        subscription_expires_at,
        flyers_created,
        flyers_exported,
        organization_logo,
        created_at,
        last_login
      `, { count: 'exact' });

    // Add search if provided
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,` +
        `organization_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,` +
        `phone_number.ilike.%${search}%`
      );
    }

    // Add pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data, total: count });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await dashboardAdminSupabase
      .from('user_details')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    // First, delete the user from auth.users using admin API
    const { error: authError } = await dashboardAdminSupabase.auth.admin.deleteUser(
      id
    );

    if (authError) {
      console.error('Error deleting user from auth:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // The trigger will automatically delete the user from user_details
    // But let's verify the deletion
    const { data: remainingUser, error: checkError } = await dashboardAdminSupabase
      .from('user_details')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is what we want
      console.error('Error checking user deletion:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (remainingUser) {
      // If the trigger didn't work, delete manually
      const { error: deleteError } = await dashboardAdminSupabase
        .from('user_details')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting user from user_details:', deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 