import { redirect } from 'next/navigation';

// Redirect old game pages to lotto
export default function CasinoPage() {
  redirect('/c/buy');
}
