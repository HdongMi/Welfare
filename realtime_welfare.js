
// 공공데이터포털에서 발급받은 인증키
const API_KEY = 'e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b';

async function getRealTimePolicies() {
    // 중앙부처 실시간 정책 API (최신순 50건 수집)
    const target = `https://apis.data.go.kr/1352000/getWelfareServiceList/getWelfareServiceList?serviceKey=${API_KEY}&callTp=L&pageNo=1&numOfRows=50`;
    
    // 보안 차단(CORS) 우회를 위한 프록시 통로
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;

    try {
        const response = await fetch(proxy);
        const json = await response.json();
        
        // 가져온 데이터를 XML로 해석
        const parser = new DOMParser();
        const xml = parser.parseFromString(json.contents, "text/xml");
        const items = xml.getElementsByTagName("servList");

        if (items.length === 0) return [];

        // 주신 소스코드 형식(source, title, link, deadline)에 맞춰 데이터 매핑
        return Array.from(items).map(item => ({
            source: item.getElementsByTagName("jurMnstNm")[0]?.textContent || "중앙부처",
            title: item.getElementsByTagName("servNm")[0]?.textContent || "정책명 없음",
            link: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?servId=${item.getElementsByTagName("servId")[0]?.textContent}`,
            deadline: item.getElementsByTagName("bizPrdEn")[0]?.textContent || "상세참조"
        }));
    } catch (e) {
        console.error("실시간 수집 에러:", e);
        return [];
    }
}
