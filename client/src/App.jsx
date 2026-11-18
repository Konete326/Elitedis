import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ShellProvider } from './context/ShellContext';
import { ComingSoonModal, PwaInstallPrompt, ToastContainer } from './components/global';
import ErrorBoundary from './pages/errors/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ShellProvider>
              <AppRoutes />
              <ComingSoonModal />
              <ToastContainer />
              <PwaInstallPrompt />
            </ShellProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
