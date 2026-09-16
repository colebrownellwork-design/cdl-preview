import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/data/body';
import { title, description } from '@/app/_prototype/data/meta';
import '@/app/_prototype/data/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="data" html={body} />;
}
