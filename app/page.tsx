import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/home/body';
import { title, description } from '@/app/_prototype/home/meta';
import '@/app/_prototype/home/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="home" html={body} />;
}
