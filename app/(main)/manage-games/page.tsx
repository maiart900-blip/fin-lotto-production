import { redirect } from 'next/navigation';

// Games feature removed - redirect to lotteries management
export default function ManageGamesPage() {
  redirect('/lotteries');
}
