import { Routes, Route, useLocation } from 'react-router-dom';
import { ItemProvider } from './context/ItemContext';
import { AuthProvider } from './context/AuthContext';
import { FamilyProvider } from './context/FamilyContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Storage from './pages/Storage';
import Add from './pages/Add';
import Recipes from './pages/Recipes';
import Profile from './pages/Settings';
import EditProfile from './pages/EditProfile';
import Login from './pages/Login';
import Legal from './pages/Legal';
import Contact from './pages/Contact';

function App() {
  const location = useLocation();

  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <FamilyProvider>
            <ItemProvider>
          <Routes location={location}>
            <Route path="/login" element={<Login />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="storage" element={<Storage />} />
              <Route path="add" element={<Add />} />
              <Route path="recipes" element={<Recipes />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/edit" element={<EditProfile />} />
              <Route path="settings" element={<Profile />} />
            </Route>
          </Routes>
            </ItemProvider>
          </FamilyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;