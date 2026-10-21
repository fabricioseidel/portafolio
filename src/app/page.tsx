import { SiteRenderer } from '@/components/SiteRenderer';
import { site } from '@/core/site';

export default function Home() {
  return (
    <div id="top">
      <SiteRenderer site={site} />
    </div>
  );
}
