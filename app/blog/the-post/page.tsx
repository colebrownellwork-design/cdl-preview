import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/post/body';
import { title, description } from '@/app/_prototype/post/meta';
import '@/app/_prototype/post/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="post" html={body} />;
}
