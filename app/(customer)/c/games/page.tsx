import { redirect } from 'next/navigation';

// Redirect old game pages to lotto
export default function GamesPage() {
  redirect('/c/buy');
}
