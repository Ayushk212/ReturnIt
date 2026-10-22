import Categories from '../components/home/Categories';
import FinalCta from '../components/home/FinalCta';
import Hero from '../components/home/Hero';
import HowItWorks from '../components/home/HowItWorks';
import Journeys from '../components/home/Journeys';
import Trust from '../components/home/Trust';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';

export default function Landing() {
  const active = useAsync((signal) => api.listItems({}, signal), []);
  const resolved = useAsync((signal) => api.listItems({ status: 'resolved' }, signal), []);

  const items = active.data ?? [];
  const returned = resolved.data ?? [];

  return (
    <>
      <Hero latest={items.slice(0, 2)} />
      <Journeys />
      <Categories items={items} loading={active.loading} />
      <HowItWorks />
      <Trust returned={returned} />
      <FinalCta />
    </>
  );
}
