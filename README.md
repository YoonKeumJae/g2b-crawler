# G2B 입찰공고 Crawler

나라장터(G2B)에서 입찰공고를 키워드로 검색하고 상세 정보를 수집한 뒤, 공공데이터포털 공식 API로 낙찰/계약 진행 정보를 보강해 `output/results.xlsx` 리포트를 생성합니다. 데이터베이스는 사용하지 않습니다.

## Features

- 공고명 키워드 검색
- 공고일 기준 최근 6개월 자동 필터링
- 전체 페이지 자동 순회
- 각 공고 상세 페이지의 템플릿 항목 추출
- 공공데이터포털 계약과정통합공개서비스 기반 낙찰/계약 정보 보강
- 계약과정통합공개서비스 무결과 시 낙찰정보서비스(`ScsbidInfoService`) 보조 조회
- XLSX 한 파일에 키워드별 상세 시트와 통합 리포트 시트 생성
- 개별 공고/API 실패는 전체 실행을 중단하지 않고 `오류로그` 시트에 기록

## Requirements

- Node.js 18+
- Playwright Chromium
- 공공데이터포털 서비스키

## Installation

```bash
npm install
npx playwright install chromium
```

## Configuration

`config.js`에서 검색 조건과 출력 경로를 변경할 수 있습니다.

```js
module.exports = {
  keywords: ['ees', '오피스365', 'ms오피스'],
  headless: true,
  outputPath: 'output/results.xlsx',
  apiEnabled: true,
  apiTimeoutMs: 20000,
  apiRetries: 2,
  serviceKey: process.env.DATA_GO_KR_SERVICE_KEY,
};
```

API 키는 파일에 저장하지 않고 환경변수로만 전달합니다. 공공데이터포털의 Encoding 인증키와 Decoding 인증키 모두 사용할 수 있으며, 내부에서 한 번만 URL 인코딩되도록 정규화합니다.

```bash
export DATA_GO_KR_SERVICE_KEY='공공데이터포털_서비스키'
npm start
```

`DATA_GO_KR_SERVICE_KEY`가 없으면 낙찰/계약 보강을 할 수 없으므로 크롤러가 시작 전에 명확한 오류 메시지로 중단합니다.

## Output

결과 파일은 `output/results.xlsx`에 저장됩니다.

- 키워드별 시트: `template.xlsx`의 기존 헤더와 형식을 사용한 공고 상세 데이터
- `통합리포트`: 공고 상세 정보와 낙찰/계약 요약 정보
- `낙찰정보`: API 응답에서 추출한 낙찰 주요 필드와 원본 JSON
- `계약정보`: API 응답에서 추출한 계약 주요 필드와 원본 JSON
- `오류로그`: 행 처리, 공고번호 정규화, API 조회 오류

`통합리포트`의 `리포트상태` 값은 다음 중 하나입니다.

- `계약 확인`: 계약업체 또는 계약금액이 확인됨
- `낙찰 확인`: 계약은 없지만 낙찰업체 또는 낙찰금액이 확인됨
- `공고만 확인`: 공식 API에 결과가 없어서 공고 상세 정보만 남김
- `API 조회 실패`: API 오류, timeout, 파싱 오류 등으로 보강 실패
- `공고번호 없음`: `입찰공고번호`를 `공고번호-차수` 형태로 정규화할 수 없음

공식 API에서 결과가 없는 경우도 실패로 처리하지 않고 `공고만 확인` 상태로 리포트에 남깁니다.

## Test

```bash
npm test -- --runInBand
```

## Project Structure

```
├── crawler.js          # 전체 크롤링 및 API 보강 파이프라인
├── config.js           # 검색 키워드, 날짜 범위, 출력/API 설정
├── search.js           # 검색 폼 입력 및 제출
├── paginator.js        # 결과 목록 페이지 순회
├── detail.js           # 상세 페이지 접속 및 데이터 추출
├── bidKey.js           # 입찰공고번호 정규화
├── g2bApiClient.js     # 공공데이터포털 REST 클라이언트
├── contractProcess.js  # 계약과정통합공개서비스 조회
├── awardInfo.js        # 낙찰정보서비스 조회
├── enrichment.js       # 계약/낙찰 API 보강 순서 제어
├── reportRows.js       # 통합 리포트 행 변환
├── writer.js           # XLSX 작성
└── output/             # 결과 XLSX 저장 폴더
```
