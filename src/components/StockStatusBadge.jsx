export default function StockStatusBadge({ currentStock, reorderPoint }) {
  let textColor, label;
  if (currentStock === 0) {
    textColor = '#F24E2C';
    label = 'Out of Stock';
  } else if (currentStock <= reorderPoint * 2) {
    textColor = '#FF9000';
    label = currentStock <= reorderPoint ? 'Low Stock' : 'Medium';
  } else {
    textColor = '#64E13C';
    label = 'Healthy';
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: '#111111', borderRadius: 40,
      paddingLeft: 8, paddingRight: 8, height: 24,
      fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
      color: textColor, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}