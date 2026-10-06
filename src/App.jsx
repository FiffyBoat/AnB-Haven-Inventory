import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { HeaderActionProvider } from '@/lib/HeaderActionContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import Team from './pages/Team';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AccessibilityStatement from './pages/AccessibilityStatement';
import Login from './pages/Login';
import DataManagement from './pages/DataManagement';
import DailyClosing from './pages/DailyClosing';
import StockCount from './pages/StockCount';
import ReorderList from './pages/ReorderList';
import ActivityLog from './pages/ActivityLog';


const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:productId" element={<ProductDetail />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/closing" element={<DailyClosing />} />
        <Route path="/stock-count" element={<StockCount />} />
        <Route path="/reorder" element={<ReorderList />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/team" element={<Team />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/accessibility-statement" element={<AccessibilityStatement />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>

    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <HeaderActionProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </HeaderActionProvider>
    </AuthProvider>
  )
}

export default App
