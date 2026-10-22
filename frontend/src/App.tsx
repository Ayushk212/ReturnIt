import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import { PageLoader } from './components/States';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Recent = lazy(() => import('./pages/Recent'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const PostItem = lazy(() => import('./pages/PostItem'));
const Profile = lazy(() => import('./pages/Profile'));
const SignIn = lazy(() => import('./pages/SignIn'));
const Safety = lazy(() => import('./pages/Safety'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Messages = lazy(() => import('./pages/Messages'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="recent" element={<Recent />} />
            <Route path="safety" element={<Safety />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="items/:id" element={<RequireAuth><ItemDetail /></RequireAuth>} />
            <Route path="post" element={<RequireAuth><PostItem /></RequireAuth>} />
            <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
            <Route path="messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="u/:id" element={<RequireAuth><PublicProfile /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
