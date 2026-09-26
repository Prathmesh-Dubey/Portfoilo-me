import { Loader } from '@/components/Loader';

// Shown while a page is loading (slow network, cold start).
export default function Loading() {
  return (
    <div className="loader-screen">
      <Loader />
    </div>
  );
}
