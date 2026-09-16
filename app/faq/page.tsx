import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/faq/body';
import { title, description } from '@/app/_prototype/faq/meta';
import '@/app/_prototype/faq/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="faq" html={body} />;
}
