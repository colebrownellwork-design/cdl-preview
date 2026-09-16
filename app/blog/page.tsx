import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/blog/body';
import { title, description } from '@/app/_prototype/blog/meta';
import '@/app/_prototype/blog/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="blog" html={body} />;
}
