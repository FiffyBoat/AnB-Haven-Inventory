export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'Inter, sans-serif', color: '#111111' }}>
      <h1 style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 14, color: '#898989', marginBottom: 48 }}>Last updated: July 27, 2026</p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. Introduction</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          This Privacy Policy describes how SupplyChain ("we", "us", or "our") collects, uses, and protects information
          when you use our supply chain management platform. By accessing or using the platform, you agree to the
          practices described in this policy.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. Information We Collect</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333', marginBottom: 12 }}>We collect the following categories of information:</p>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li><strong>Account information:</strong> Name and email address when you register or are invited.</li>
          <li><strong>Inventory data:</strong> Product details, stock levels, SKUs, and movement records you enter into the platform.</li>
          <li><strong>Supplier data:</strong> Supplier names, contact details, and procurement records.</li>
          <li><strong>Purchase order data:</strong> Order quantities, costs, statuses, and delivery timelines.</li>
          <li><strong>Usage data:</strong> Pages visited, actions taken, and interaction timestamps for analytics and platform improvement.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. How We Use Your Information</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li>To provide, operate, and improve the supply chain management platform.</li>
          <li>To generate AI-powered restock suggestions and demand forecasts.</li>
          <li>To send platform notifications and operational alerts.</li>
          <li>To authenticate users and enforce role-based access controls.</li>
          <li>To comply with applicable legal obligations.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. Data Sharing</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We do not sell your data. We may share information with trusted service providers who assist in operating the
          platform (e.g., cloud hosting, AI processing) under strict data processing agreements. We may also disclose
          information where required by law or to protect the rights and safety of our users.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. Data Retention</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We retain your data for as long as your account is active or as needed to provide services. Inventory,
          supplier, and purchase order records are retained for a minimum of 7 years to support auditing and compliance
          requirements typical in supply chain operations. You may request deletion of your account data by contacting us.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>6. Security</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We implement industry-standard security measures including encryption in transit (TLS), role-based access
          controls, and regular security reviews. However, no system is completely secure and we cannot guarantee
          absolute security of your data.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>7. Your Rights</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333', marginBottom: 12 }}>Depending on your jurisdiction, you may have the right to:</p>
        <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20 }}>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data (subject to retention obligations).</li>
          <li>Object to or restrict certain processing activities.</li>
          <li>Data portability where technically feasible.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>8. Cookies</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We use essential cookies and session tokens to keep you authenticated. We may use analytics cookies to
          understand platform usage patterns. You can manage cookie preferences through your browser settings.
        </p>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>9. Changes to This Policy</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          We may update this Privacy Policy from time to time. We will notify registered users of material changes via
          email or an in-app notice. Continued use of the platform after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>10. Contact Us</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#333' }}>
          If you have questions about this Privacy Policy or wish to exercise your rights, please contact us through
          the platform's support channel or reach out to your account administrator.
        </p>
      </section>
    </main>
  );
}