# G2B 입찰공고 Crawler

나라장터(G2B)에서 입찰공고를 키워드로 검색하고, 공고 상세/RFP 첨부파일/낙찰 결과를 JSON과 Excel 파일로 저장하는 자동화 크롤러입니다.

## Features

- 공고명 키워드 검색 (기본값: `ees`)
- 공고일 기준 최근 6개월 자동 필터링
- 전체 페이지 자동 순회 (페이지네이션 처리)
- 각 공고의 상세 페이지 접속 후 모든 항목 추출
- G2B 화면의 RAONK 첨부 컨트롤에서 RFP/제안요청서/과업지시서/규격서 추출 및 다운로드
- 공공데이터포털 나라장터 낙찰정보 API를 통한 낙찰 업체 조회
- 물품/용역/공사/외자 낙찰 API fallback 조회
- 낙찰 결과 상태 분류 (`awarded`, `not_opened_yet`, `not_found`, `lookup_failed` 등)
- 결과를 JSON 파일로 중간 저장하고 Excel 리포트로 저장

## Requirements

- Node.js 18+
- Playwright (Chromium)

## Installation

```bash
npm install
npx playwright install chromium
```

## Configuration

`config.js` 에서 검색 조건을 변경할 수 있습니다.

```js
module.exports = {
  keywords: ['ees', '오피스365', 'ms오피스'],
  headless: true,
  outputPath: 'output/results.xlsx',
  jsonOutputPath: 'output/results.json',
  attachmentDir: 'output/attachments',
};
```

낙찰 업체까지 채우려면 공공데이터포털에서 `조달청_나라장터 낙찰정보서비스` 활용신청 후 API 키를 환경변수로 설정합니다.

```bash
export DATA_GO_KR_API_KEY="발급받은_API_키"
```

API 키가 없으면 크롤러는 공고/RFP/첨부파일 정보까지 저장하고, 낙찰 결과는 `not_configured` 상태로 남깁니다. `.env` 파일에 `DATA_GO_KR_API_KEY=...`를 저장해도 됩니다.

낙찰 조회는 `ScsbidInfoService`에 `inqryDiv=4`와 `bidNtceNo=<입찰공고번호>`를 사용합니다. 업무구분에 따라 아래 엔드포인트를 순차 조회합니다.

| 업무구분 | 엔드포인트 |
|----------|------------|
| 물품 | `getScsbidListSttusThng` |
| 용역 | `getScsbidListSttusServc` |
| 공사 | `getScsbidListSttusCnstwk` |
| 외자 | `getScsbidListSttusFrgcpt` |

## Usage

```bash
npm start
```

첨부파일/RFP는 공공데이터포털 낙찰 API가 아니라 실제 G2B 상세 화면의 첨부 컨트롤에서 수집합니다. 추출이 되지 않는 공고는 실사이트 구조 확인용 probe를 실행합니다.

```bash
npm run probe:attachments -- ees 0
```

결과 파일은 다음 위치에 저장됩니다.

| 경로 | 설명 |
|------|------|
| `output/results.json` | 공고, 상세 필드, 첨부파일, 낙찰 결과를 담은 구조화 원본 |
| `output/results.xlsx` | 사람이 보기 좋은 Excel 리포트 |
| `output/attachments/<입찰공고번호>/` | RFP/제안요청서/과업지시서/규격서 등 다운로드 파일 |

## Output

Excel 시트:

| 시트 | 설명 |
|------|------|
| 키워드별 시트 | `template.xlsx` 헤더에 맞춘 공고 상세 필드 |
| `Summary` | 공고별 요약, 낙찰 업체, 낙찰 금액, RFP 파일 수 |
| `Attachments` | 첨부파일명, 분류, 다운로드 상태, 로컬 경로 |
| `Awards` | 낙찰상태, 분류, 낙찰업체, 사업자번호, 낙찰금액, 투찰률 |
| `Vendor Summary` | 낙찰업체별 낙찰건수와 총낙찰금액 |

추출되는 주요 상세 항목:

| 항목 | 설명 |
|------|------|
| 공고번호 | 입찰공고 고유번호 |
| 공고명 | 공고 제목 |
| 공고기관 | 공고를 낸 기관명 |
| 수요기관 | 실제 수요 기관명 |
| 계약방법 | 일반경쟁, 제한경쟁 등 |
| 공고일 | 공고 게시일 |
| 입찰마감일시 | 입찰 마감 일시 |
| 개찰일시 | 개찰 예정 일시 |
| 예산금액 | 해당 공고의 예산 |
| 담당자 | 담당자명 및 연락처 |
| 기타 항목 | 상세 페이지에 표시되는 모든 항목 |

## Project Structure

```
├── crawler.js        # 진입점 — 전체 파이프라인 실행
├── config.js         # 검색 키워드, 날짜 범위, 출력 경로 설정
├── search.js         # 검색 폼 입력 및 제출
├── paginator.js      # 결과 목록 페이지 순회 및 URL 수집
├── detail.js         # 상세 페이지 접속 및 데이터 추출
├── attachment.js     # 첨부파일 추출, 분류, 다운로드
├── attachmentProbe.js # 실사이트 첨부파일 DOM 진단
├── award.js          # 낙찰정보 OpenAPI 조회 및 정규화
├── resultStore.js    # JSON 원본 저장소
├── writer.js         # Excel 리포트 작성
└── output/           # 결과 파일 저장 폴더 (자동 생성)
```
