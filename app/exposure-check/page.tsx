import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/check/body';
import { title, description } from '@/app/_prototype/check/meta';
import '@/app/_prototype/check/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="check" html={body} />;
}
