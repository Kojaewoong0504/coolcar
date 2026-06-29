import Link from 'next/link';

export default function DataSourcePage() {
  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>데이터 출처</div><Link className="ghost" href="/">홈</Link></header>
      <section className="hero-card compact"><p className="eyebrow">Trust & Source</p><h1>실측처럼 보이는<br />추정은 하지 않아요.</h1><p>시원칸은 추천마다 데이터 출처와 신뢰도를 같이 보여줍니다.</p></section>
      <section className="card source-grid">
        <div><b>실측</b><p>공식 API의 열차/칸 단위 실시간 또는 준실시간 데이터입니다.</p></div>
        <div><b>통계</b><p>TMAP/SK 칸별 혼잡도 통계, 시간대 패턴, 약냉방칸 규칙을 사용합니다.</p></div>
        <div><b>추정</b><p>수인분당선처럼 칸별 공개 데이터가 없는 노선에서 규칙 기반으로 안내합니다.</p></div>
        <div><b>커뮤니티</b><p>사용자 피드백이 충분히 쌓이면 보조 신호로 반영합니다.</p></div>
      </section>
      <section className="card"><div className="section-title">신뢰도 기준</div><ul className="reasons"><li>높음: 공식 칸별 데이터가 정상 응답했고 추천에 반영된 경우</li><li>보통: 공식 API 장애/키 문제로 통계형 fallback을 사용한 경우</li><li>낮음: 칸별 데이터가 없어 시간대·위치 패턴 기반 추정만 가능한 경우</li></ul><p className="notice">추천은 참고용입니다. 실제 객실 온도와 혼잡은 열차·운행 상황에 따라 달라질 수 있어요.</p></section>
      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link className="active" href="/data-source">데이터</Link><Link href="/settings">설정</Link></nav>
    </main>
  );
}
