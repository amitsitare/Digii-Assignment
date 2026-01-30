import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Container, Col, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(location.state?.message ?? null);
  
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      
      // Check if password change is required
      if (data.user.must_change_password) {
        navigate('/change-password');
        return;
      }

      // Navigate based on role
      switch (data.user.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'professor':
          navigate('/professor');
          break;
        case 'student':
          navigate('/student');
          break;
        default:
          navigate(from);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Col md={6} className="auth-branding d-none d-md-flex">
        <div>
          <h1 className="display-5 fw-bold mb-4">CampusOne</h1>
          <p className="lead opacity-75">
            Empowering education through technology
          </p>
        </div>
      </Col>
      
      <Col md={6} className="auth-form-container">
        <Container style={{ maxWidth: '400px' }}>
          <div className="d-md-none text-center mb-4">
            <Link to="/" className="text-decoration-none">
              <h4 className="text-primary">CampusOne</h4>
            </Link>
          </div>
          
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your account</p>

          {successMessage && (
            <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}
          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                className="form-input"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button
              type="submit"
              className="btn-primary-gradient w-100 mb-4"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form>

          <hr />

          <p className="text-center mb-3">
            Are you an Admin?{' '}
            <Link to="/register" className="text-primary text-decoration-none">
              Register Here
            </Link>
          </p>

          <div className="alert-info-custom">
            <strong>Note:</strong> Students and Professors contact administration 
            for login credentials.
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="text-muted text-decoration-none">
              Back to Home
            </Link>
          </div>
        </Container>
      </Col>
    </div>
  );
};

export default Login;
