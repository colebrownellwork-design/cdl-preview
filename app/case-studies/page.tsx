import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/case/body';
import { title, description } from '@/app/_prototype/case/meta';
import '@/app/_prototype/case/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="case" html={body} />;
}
