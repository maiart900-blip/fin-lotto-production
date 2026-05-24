import { redirect } from 'next/navigation';

// Redirect old game pages to lotto
export default function SlotsPage() {
  redirect('/c/buy');
}
