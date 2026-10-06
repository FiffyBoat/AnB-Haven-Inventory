import { Link } from "react-router-dom";

export default function TabletBottomNav({ items, activePath }) {
  return (
    <div className="flex lg:hidden fixed bottom-0 left-0 right-0 z-50 justify-center pb-4 pointer-events-none">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 42,
          paddingLeft: 4,
          paddingRight: 4,
          borderRadius: 100,
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          pointerEvents: "all",
          overflow: "visible",
        }}>
        {(items || []).map((item) => {
          const Icon = item.icon;
          const isSelected =
            item.path === "/" ? activePath === "/" : activePath === item.path || activePath.startsWith(item.path + "/");
          if (isSelected) {
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  height: 48,
                  paddingLeft: 16,
                  paddingRight: 16,
                  background: "#FFFFFF",
                  borderRadius: 100,
                  textDecoration: "none",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}>
                {Icon && <Icon size={14} color="#111111" />}
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 500, color: "#111111", whiteSpace: "nowrap" }}>{item.name}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#DFDFDF",
                textDecoration: "none",
                flexShrink: 0,
              }}>
              {Icon && <Icon size={14} color="#111111" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}