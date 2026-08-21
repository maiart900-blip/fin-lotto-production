import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Get user credit info and transfer history
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (userId) {
      // Get specific user credit info
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, display_name, role, credit_balance, is_unlimited_credit, parent_id, hierarchy_level')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[v0] User credit GET error:', error.message);
        return NextResponse.json(null);
      }

      // Get transfer history
      const { data: transfers } = await supabase
        .from('user_credit_transfers')
        .select(`
          *,
          sender:users!user_credit_transfers_sender_id_fkey(id, username, display_name),
          receiver:users!user_credit_transfers_receiver_id_fkey(id, username, display_name),
          receiver_customer:customers(id, name)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      return NextResponse.json({
        user,
        transfers: transfers || [],
      });
    }

    // Get all users with credit info
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_unlimited_credit, parent_id, hierarchy_level')
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Users credit GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] User credits GET exception:', err);
    return NextResponse.json([]);
  }
}

// POST - Transfer credit
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { sender_id, receiver_id, receiver_customer_id, amount, note } = body;

    if (!sender_id || (!receiver_id && !receiver_customer_id) || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer data' }, { status: 400 });
    }

    // Get sender info
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('id, credit_balance, is_unlimited_credit')
      .eq('id', sender_id)
      .single();

    if (senderError || !sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    // Check if sender has enough credit (unless unlimited)
    if (!sender.is_unlimited_credit && sender.credit_balance < amount) {
      return NextResponse.json({ error: 'Insufficient credit balance' }, { status: 400 });
    }

    // Calculate new balances
    const senderBalanceBefore = sender.credit_balance;
    const senderBalanceAfter = sender.is_unlimited_credit ? sender.credit_balance : sender.credit_balance - amount;

    if (receiver_customer_id) {
      // Transfer to customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, credit_balance')
        .eq('id', receiver_customer_id)
        .single();

      if (customerError || !customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      const customerBalanceBefore = customer.credit_balance || 0;
      const customerBalanceAfter = customerBalanceBefore + amount;

      // Update sender balance (if not unlimited)
      if (!sender.is_unlimited_credit) {
        await supabase
          .from('users')
          .update({ credit_balance: senderBalanceAfter })
          .eq('id', sender_id);
      }

      // Update customer balance
      await supabase
        .from('customers')
        .update({ credit_balance: customerBalanceAfter })
        .eq('id', receiver_customer_id);

      // Record transfer
      const { data: transfer, error: transferError } = await supabase
        .from('user_credit_transfers')
        .insert({
          sender_id,
          receiver_id: sender_id, // Self for customer transfers
          receiver_customer_id,
          amount,
          sender_balance_before: senderBalanceBefore,
          sender_balance_after: senderBalanceAfter,
          receiver_balance_before: customerBalanceBefore,
          receiver_balance_after: customerBalanceAfter,
          note: note || `โอนเครดิตให้ลูกค้า`,
        })
        .select()
        .single();

      if (transferError) {
        console.error('[v0] Transfer record error:', transferError.message);
      }

      // Also record in credit_transactions for customer
      await supabase
        .from('credit_transactions')
        .insert({
          customer_id: receiver_customer_id,
          type: 'deposit',
          amount,
          balance_before: customerBalanceBefore,
          balance_after: customerBalanceAfter,
          sender_id,
          sender_type: 'user',
          receiver_type: 'customer',
          note: note || `รับเครดิตจาก ${sender_id}`,
          created_by: sender_id,
        });

      return NextResponse.json({
        success: true,
        transfer,
        sender_balance: senderBalanceAfter,
        receiver_balance: customerBalanceAfter,
      });
    } else {
      // Transfer to another user
      const { data: receiver, error: receiverError } = await supabase
        .from('users')
        .select('id, credit_balance')
        .eq('id', receiver_id)
        .single();

      if (receiverError || !receiver) {
        return NextResponse.json({ error: 'Receiver not found' }, { status: 404 });
      }

      const receiverBalanceBefore = receiver.credit_balance || 0;
      const receiverBalanceAfter = receiverBalanceBefore + amount;

      // Update sender balance (if not unlimited)
      if (!sender.is_unlimited_credit) {
        await supabase
          .from('users')
          .update({ credit_balance: senderBalanceAfter })
          .eq('id', sender_id);
      }

      // Update receiver balance
      await supabase
        .from('users')
        .update({ credit_balance: receiverBalanceAfter })
        .eq('id', receiver_id);

      // Record transfer
      const { data: transfer, error: transferError } = await supabase
        .from('user_credit_transfers')
        .insert({
          sender_id,
          receiver_id,
          amount,
          sender_balance_before: senderBalanceBefore,
          sender_balance_after: senderBalanceAfter,
          receiver_balance_before: receiverBalanceBefore,
          receiver_balance_after: receiverBalanceAfter,
          note: note || `โอนเครดิต`,
        })
        .select()
        .single();

      if (transferError) {
        console.error('[v0] Transfer record error:', transferError.message);
      }

      return NextResponse.json({
        success: true,
        transfer,
        sender_balance: senderBalanceAfter,
        receiver_balance: receiverBalanceAfter,
      });
    }
  } catch (err) {
    console.error('[v0] User credits POST exception:', err);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
