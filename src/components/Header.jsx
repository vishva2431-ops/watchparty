export default function Header({ userName }) {
  return (
    <div className="header">
      <div>
        <h2>Watch Party</h2>
        <p className="header-sub">Watch movies together in sync</p>
      </div>
      <div className="user-pill">{userName || "Guest"}</div>
    </div>
  );
}