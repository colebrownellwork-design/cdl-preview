import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/pricing/body';
import { title, description } from '@/app/_prototype/pricing/meta';
import '@/app/_prototype/pricing/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="pricing" html={body} />;
}
