// 파일명: realtime_welfare.js
const API_KEY = 'e8e40ea23b405a5abba75382a331e61f9052570e9e95a7ca6cf5db14818ba22b';

async function getRealTimePolicies() {
    // 1. 공공데이터 API 주소 설정
    const baseUrl = 'https://apis.data.go.kr/1352000/getWelfareServiceList/getWelfareServiceList';
    const params = `serviceKey=${API_KEY}&callTp=L&pageNo=1&numOfRows=50`;
    const targetUrl = `${baseUrl}?${params}`;
    
    // 2. Github.io 환경에서 가장 안정적인 우회 통로 (Cloudflare Worker 기반)
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${targetUrl}`;
    // 만약 위 주소가 막히면 아래 주소로 교체해서 시도해보세요.
    // const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) throw new Error("네트워크 응답 오류");

        let xmlText;
        // 프록시 종류에 따라 데이터 추출 방식이 다름
        if (proxyUrl.includes('allorigins')) {
            const json = await response.json();
            xmlText = json.contents;
        } else {
            xmlText = await response.text();
        }

        if (!xmlText) throw new Error("데이터 수집 실패");

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const items = xml.getElementsByTagName("servList");

        if (items.length === 0) {
            console.log("데이터 없음. 키 등록 여부 확인 필요.");
            return [];
        }

        return Array.from(items).map(item => ({
            source: item.getElementsByTagName("jurMnstNm")[0]?.textContent || "중앙부처",
            title: item.getElementsByTagName("servNm")[0]?.textContent || "정책명 없음",
            link: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52005M.do?servId=${item.getElementsByTagName("servId")[0]?.textContent}`,
            deadline: item.getElementsByTagName("bizPrdEn")[0]?.textContent || "상세참조"
        }));

    } catch (e) {
        console.error("데이터 로드 실패:", e);
        return [];
    }
}
