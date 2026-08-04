import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

export default function Splash() {
  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
        background: "#ffffff",
      }}
    >
      <Typography variant="h5" sx={{ margin: 0 }}>
        Reckon
      </Typography>
      <CircularProgress size={36} />
      <Typography color="text.secondary">Đang khởi động…</Typography>
    </div>
  );
}
