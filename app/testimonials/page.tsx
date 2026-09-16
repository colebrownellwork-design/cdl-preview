import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/testimonials/body';
import { title, description } from '@/app/_prototype/testimonials/meta';
import '@/app/_prototype/testimonials/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="testimonials" html={body} />;
}
