import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import logoImg from '../assets/CampusOne.jpg';

const whatWeSolveData = [
  { id: 1, problem: 'Timetable Management', solution: 'No more printed schedules. Digital timetables updated in real-time with instant notifications for any changes.', accent: 'primary' },
  { id: 2, problem: 'Communication Gap', solution: 'Instant messaging between administration, professors, and students. Broadcast messages to departments or batches.', accent: 'purple' },
  { id: 3, problem: 'Missed Classes', solution: 'Get notified 15 minutes before every class starts. Never miss an important lecture again.', accent: 'teal' },
  { id: 4, problem: 'Room Conflicts', solution: 'Smart scheduling with automatic conflict detection for rooms and professors. Book auditoriums hassle-free.', accent: 'pink' },
];

const Home = () => {
  const { hash } = useLocation();

  // When navigating to /#features (from header or footer on another page), scroll to features section
  useEffect(() => {
    if (hash === '#features') {
      const el = document.getElementById('features');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-image" aria-hidden="true" />
        <div className="hero-overlay" aria-hidden="true" />
        <Container className="hero-content-wrapper">
          <Row className="align-items-center justify-content-center">
            <Col lg={9} xl={8} className="text-center">
              <p className="hero-badge">Welcome to</p>
              <h1 className="hero-title">CampusOne</h1>
              <p className="hero-subtitle">
                One platform to manage timetables, classrooms, and communication
                across your entire campus.
              </p>
              <div className="hero-cta">
                <Link to="/login" className="btn btn-hero-primary">
                  Get Started
                </Link>
                <Link to="/register" className="btn btn-hero-outline">
                  Admin Registration
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* What We Solve Section - Hierarchy / Table layout */}
      <section className="py-5 what-we-solve-section" id="what-we-solve">
        <Container>
          <h2 className="text-center mb-2 section-heading">What We Solve</h2>
          <p className="text-center text-muted mb-4 section-sub">Problems we address — and how CampusOne fixes them</p>
          <div className="solve-table-wrapper">
            <div className="solve-table-header">
              <span className="solve-col-index">#</span>
              <span className="solve-col-problem">Problem</span>
              <span className="solve-col-solution">Our Solution</span>
            </div>
            {whatWeSolveData.map((item) => (
              <div key={item.id} className={`solve-table-row solve-accent-${item.accent}`}>
                <span className="solve-col-index">
                  <span className="solve-index-badge">{item.id}</span>
                </span>
                <span className="solve-col-problem">
                  <strong>{item.problem}</strong>
                </span>
                <span className="solve-col-solution">{item.solution}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* How It Works Section */}
      <section className="py-5 bg-light" id="about">
        <Container>
          <h2 className="text-center mb-5">How It Works</h2>
          <Row className="g-4">
            <Col md={4}>
              <div className="text-center">
                <div className="display-4 fw-bold text-primary mb-3">01</div>
                <h5>Admin Setup</h5>
                <p className="text-muted">
                  Admin registers and sets up departments, classrooms, and timetables. 
                  Add students and professors - they receive login credentials via email.
                </p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <div className="display-4 fw-bold text-primary mb-3">02</div>
                <h5>Professors Manage</h5>
                <p className="text-muted">
                  Professors view their assigned classes and can reschedule if needed. 
                  Students are notified instantly of any changes.
                </p>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <div className="display-4 fw-bold text-primary mb-3">03</div>
                <h5>Students Stay Updated</h5>
                <p className="text-muted">
                  Students view their timetable, receive notifications before classes, 
                  and chat with classmates and professors.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Grid */}
      <section className="py-5 features-section" id="features">
        <Container>
          <div className="features-section-header text-center mb-5">
            <h2 className="section-heading features-heading">Features</h2>
            <p className="section-sub features-sub">
              Everything you need to run and stay on top of campus life
            </p>
          </div>
          <Row className="g-4">
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-primary h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-primary">1</div>
                  <h5 className="feature-title">Real-time Updates</h5>
                  <p className="feature-desc text-muted mb-0">
                    Changes reflect instantly to all users. No refresh, no delay.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-purple h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-purple">2</div>
                  <h5 className="feature-title">Role-based Access</h5>
                  <p className="feature-desc text-muted mb-0">
                    Admin, Professor, and Student permissions enforced across the platform.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-teal h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-teal">3</div>
                  <h5 className="feature-title">Instant Messaging</h5>
                  <p className="feature-desc text-muted mb-0">
                    Chat with anyone on campus—peers, professors, or administration.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-pink h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-pink">4</div>
                  <h5 className="feature-title">Smart Scheduling</h5>
                  <p className="feature-desc text-muted mb-0">
                    Conflict detection for rooms and professors. No double-bookings.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-info h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-info">5</div>
                  <h5 className="feature-title">Notifications</h5>
                  <p className="feature-desc text-muted mb-0">
                    15-minute class reminders and change alerts sent automatically.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="feature-card feature-card-item feature-accent-primary h-100">
                <Card.Body>
                  <div className="feature-icon-wrap feature-icon-primary">6</div>
                  <h5 className="feature-title">Room Management</h5>
                  <p className="feature-desc text-muted mb-0">
                    Track classroom and auditorium bookings in one place.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* User Roles Section */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="text-center mb-5">Who Is This For?</h2>
          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card role-card-admin h-100">
                <Card.Body>
                  <h4>Administration</h4>
                  <hr />
                  <ul className="list-unstyled text-muted">
                    <li className="mb-2">- Register via Register page</li>
                    <li className="mb-2">- Add students and professors</li>
                    <li className="mb-2">- Manage all timetables</li>
                    <li className="mb-2">- Book auditoriums</li>
                    <li className="mb-2">- Message anyone</li>
                  </ul>
                  <Link to="/register" className="btn btn-primary-gradient w-100 mt-3">
                    Register as Admin
                  </Link>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="feature-card role-card-professor h-100">
                <Card.Body>
                  <h4>Professors</h4>
                  <hr />
                  <ul className="list-unstyled text-muted">
                    <li className="mb-2">- Login with provided credentials</li>
                    <li className="mb-2">- View own classes</li>
                    <li className="mb-2">- Reschedule classes</li>
                    <li className="mb-2">- Message department students</li>
                  </ul>
                  <Link to="/login" className="btn btn-outline-custom w-100 mt-3">
                    Login
                  </Link>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="feature-card role-card-student h-100">
                <Card.Body>
                  <h4>Students</h4>
                  <hr />
                  <ul className="list-unstyled text-muted">
                    <li className="mb-2">- Login with provided credentials</li>
                    <li className="mb-2">- View timetable (read-only)</li>
                    <li className="mb-2">- Get notified of changes</li>
                    <li className="mb-2">- Chat with classmates</li>
                  </ul>
                  <Link to="/login" className="btn btn-outline-custom w-100 mt-3">
                    Login
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Footer */}
      <footer className="footer">
        <Container>
          <div className="footer-main">
            <Row className="g-4 g-lg-5 align-items-start">
              <Col xs={12} md={6} lg={6}>
                <div className="footer-brand">
                  <Link to="/" className="footer-logo-link">
                    <img src={logoImg} alt="CampusOne" className="footer-logo" />
                  </Link>
                  <p className="footer-tagline">
                    One platform to manage timetables, classrooms, and communication across your entire campus.
                  </p>
                </div>
              </Col>
              <Col xs={12} sm={6} md={3} lg={3}>
                <nav className="footer-nav" aria-label="Footer navigation">
                  <h6 className="footer-heading">Quick Links</h6>
                  <ul className="footer-links list-unstyled">
                    <li><Link to="/">Home</Link></li>
                    <li>
                      <Link to="/#features">Features</Link>
                      <p className="footer-features-tagline mb-0">Everything you need to run and stay on top of campus life</p>
                    </li>
                    <li><Link to="/login">Login</Link></li>
                    <li><Link to="/register">Register</Link></li>
                  </ul>
                </nav>
              </Col>
              <Col xs={12} sm={6} md={3} lg={3}>
                <div className="footer-contact-block">
                  <h6 className="footer-heading">Contact</h6>
                  <p className="footer-contact">
                    <a href="mailto:support@campusone.edu" className="footer-contact-link">support@campusone.edu</a>
                  </p>
                </div>
              </Col>
            </Row>
          </div>
          <hr className="footer-divider" />
          <div className="footer-bottom">
            <p className="footer-copyright">
              &copy; 2026 CampusOne. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default Home;
