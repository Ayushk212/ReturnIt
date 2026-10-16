import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const PostItem = lazy(() => import('./pages/PostItem'));
const Profile = lazy(() => import('./pages/Profile'));
const SignIn = lazy(() => import('./pages/SignIn'));
const Safety = lazy(() => import('./pages/Safety'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense
        fallback={
          <div className="container-page py-24 text-muted" role="status">
            Loading…
          </div>
        }
      >
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="safety" element={<Safety />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="items/:id" element={<RequireAuth><ItemDetail /></RequireAuth>} />
            <Route path="post" element={<RequireAuth><PostItem /></RequireAuth>} />
            <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
