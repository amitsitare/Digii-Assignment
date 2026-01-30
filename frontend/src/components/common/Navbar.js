import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import logoImg from '../../assets/CampusOne.jpg';

const AppNavbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'admin':
        return '/admin';
      case 'professor':
        return '/professor';
      case 'student':
        return '/student';
      default:
        return '/';
    }
  };

  return (
    <Navbar className="navbar-custom" expand="lg" sticky="top">
      <Container>
        <Navbar.Brand as={Link} to="/" className="navbar-brand-custom">
          <img src={logoImg} alt="CampusOne" className="navbar-logo" />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center">
            {isAuthenticated ? (
              <>
                <Nav.Link as={Link} to={getDashboardLink()}>
                  Dashboard
                </Nav.Link>
                <Nav.Link as={Link} to="/chat">
                  Messages
                </Nav.Link>
                <NotificationDropdown />
                <Dropdown align="end">
                  <Dropdown.Toggle
                    variant="link"
                    className="nav-link text-decoration-none"
                    id="profile-dropdown"
                  >
                    {user?.first_name} {user?.last_name}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item as={Link} to="/profile">
                      Profile
                    </Dropdown.Item>
                    <Dropdown.Item as={Link} to="/change-password">
                      Change Password
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleLogout}>
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/#features">Features</Nav.Link>
                <Nav.Link as={Link} to="/#about">About</Nav.Link>
                <Nav.Link as={Link} to="/login">Login</Nav.Link>
                <Nav.Link as={Link} to="/register" className="btn btn-primary-gradient ms-2 text-white">
                  Register
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
