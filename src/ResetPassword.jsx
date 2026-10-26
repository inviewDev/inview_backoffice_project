import { useNavigate } from 'react-router-dom';
import ForgotPassword from './ForgotPassword.jsx';

function ResetPassword() {
  const navigate = useNavigate();
  return <ForgotPassword onBack={() => navigate('/')} />;
}

export default ResetPassword;
