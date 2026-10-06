export default function AccessibilityStatement() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'Inter, sans-serif', color: '#111111' }}>
      <h1 style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>Accessibility Statement</h1>
      <p style={{ fontSize: 14, color: '#898989', marginBottom: 48 }}>Last updated: July 27, 2026</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Our Commitment</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          SupplyChain is committed to ensuring digital accessibility for all users, including people with disabilities.
          We continually improve the user experience for everyone and apply relevant accessibility standards to our platform.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Conformance Status</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We aim to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>. These
          guidelines explain how to make web content more accessible to people with disabilities. Conformance with
          these guidelines helps make the platform more accessible to blind users, users with low vision, users with
          cognitive disabilities, and users who rely on keyboard navigation or assistive technologies.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Measures We Take</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li>Semantic HTML structure to support screen readers and assistive technologies.</li>
          <li>Sufficient color contrast ratios across key UI elements.</li>
          <li>Keyboard navigability for primary workflows including product management and purchase orders.</li>
          <li>Descriptive labels and ARIA attributes on interactive controls.</li>
          <li>Responsive design that adapts to zoom levels up to 200% without loss of content or functionality.</li>
          <li>Focus indicators on interactive elements for keyboard users.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Known Limitations</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333', marginBottom: 12 }}>
          While we strive for full accessibility, some areas of the platform may have limitations:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li>Certain animated data visualizations (charts and gauges) may not be fully conveyed to screen readers; we are working to provide text-based alternatives.</li>
          <li>Some complex interactive components (e.g., drag-and-drop reordering) may have limited keyboard equivalents.</li>
          <li>Third-party embedded content may not meet the same accessibility standards.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Assistive Technologies Supported</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333', marginBottom: 12 }}>The platform is designed to work with the following assistive technologies:</p>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li>Screen readers: NVDA, JAWS, VoiceOver (macOS/iOS), TalkBack (Android)</li>
          <li>Browser zoom and text resize</li>
          <li>Keyboard-only navigation</li>
          <li>High-contrast browser modes</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Feedback & Contact</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We welcome feedback on the accessibility of SupplyChain. If you experience barriers or have suggestions for
          improvement, please contact your account administrator or reach out via the platform's support channel.
          We aim to respond to accessibility feedback within 5 business days.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Ongoing Efforts</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          Accessibility is an ongoing effort. We regularly review and test the platform, prioritize fixing identified
          issues, and include accessibility considerations in our development process when building new features.
        </p>
      </section>
    </main>
  );
}