# G2B 입찰공고 Crawler

나라장터(G2B)에서 입찰공고를 키워드로 검색하고 상세 정보, RFP 첨부파일, 낙찰/계약 진행 정보를 수집해 JSON과 Excel 리포트로 저장하는 자동화 크롤러입니다. 데이터베이스는 사용하지 않습니다.

## Features

- 공고명 키워드 검색
- 공고일 기준 최근 6개월 자동 필터링
- 전체 페이지 자동 순회
- 각 공고 상세 페이지의 템플릿 항목 추출
- G2B 화면의 RAONK 첨부 컨트롤에서 RFP/제안요청서/과업지시서/규격서 추출 및 다운로드
- 공공데이터포털 계약과정통합공개서비스 기반 계약/낙찰 요약 보강
- 계약과정통합공개서비스 무결과 시 낙찰정보서비스(`ScsbidInfoService`) 보조 조회
- JSON 원본 저장과 XLSX 상세/분석/통합 리포트 생성
- 개별 공고/API 실패는 전체 실행을 중단하지 않고 상태값과 `오류로그` 시트에 기록

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
  jsonOutputPath: 'output/results.json',
  attachmentDir: 'output/attachments',
  apiEnabled: true,
  apiTimeoutMs: 20000,
  apiRetries: 2,
  serviceKey: process.env.DATA_GO_KR_SERVICE_KEY,
};
```

API 키는 커밋하거나 `config.js`에 하드코딩하지 않습니다. 로컬 실행에서는 환경변수 또는 git에서 제외된 `.env` 파일로 전달할 수 있습니다. `DATA_GO_KR_SERVICE_KEY`, `DATA_GO_KR_API_KEY`, `API_KEY` 중 하나를 사용할 수 있고, 공공데이터포털의 Encoding 인증키와 Decoding 인증키 모두 지원합니다.

```bash
export DATA_GO_KR_SERVICE_KEY='공공데이터포털_서비스키'
npm start
```

또는 로컬 `.env`에 다음처럼 저장합니다.

```bash
DATA_GO_KR_SERVICE_KEY='공공데이터포털_서비스키'
```

지원되는 환경변수 중 어느 곳에서도 서비스키를 찾지 못하면 낙찰/계약 보강을 할 수 없으므로 크롤러가 시작 전에 명확한 오류 메시지로 중단합니다.

## Usage

```bash
npm start
```

첨부파일/RFP는 공공데이터포털 API가 아니라 실제 G2B 상세 화면의 첨부 컨트롤에서 수집합니다. 추출이 되지 않는 공고는 실사이트 구조 확인용 probe를 실행합니다.

```bash
npm run probe:attachments -- ees 0
```

## Output

결과 파일은 다음 위치에 저장됩니다.

| 경로 | 설명 |
|------|------|
| `output/results.json` | 공고, 상세 필드, 첨부파일, 낙찰 결과를 담은 구조화 원본 |
| `output/results.xlsx` | 사람이 보기 좋은 Excel 리포트 |
| `output/attachments/<입찰공고번호>/` | RFP/제안요청서/과업지시서/규격서 등 다운로드 파일 |

Excel 시트:

| 시트 | 설명 |
|------|------|
| 키워드별 시트 | `template.xlsx` 헤더에 맞춘 공고 상세 필드 |
| `통합리포트` | 공고 상세 정보와 낙찰/계약 요약 정보 |
| `낙찰정보` | API 응답에서 추출한 낙찰 주요 필드와 원본 JSON |
| `계약정보` | API 응답에서 추출한 계약 주요 필드와 원본 JSON |
| `오류로그` | 행 처리, 공고번호 정규화, API 조회 오류 |
| `Summary` | 공고별 요약, 낙찰 업체, 낙찰 금액, RFP 파일 수 |
| `Attachments` | 첨부파일명, 분류, 다운로드 상태, 로컬 경로 |
| `Awards` | 낙찰상태, 분류, 낙찰업체, 사업자번호, 낙찰금액, 투찰률 |
| `Vendor Summary` | 낙찰업체별 낙찰건수와 총낙찰금액 |

`통합리포트`의 `리포트상태` 값은 다음 중 하나입니다.

- `계약 확인`: 계약업체 또는 계약금액이 확인됨
- `낙찰 확인`: 계약은 없지만 낙찰업체 또는 낙찰금액이 확인됨
- `공고만 확인`: 공식 API에 결과가 없어서 공고 상세 정보만 남김
- `API 조회 실패`: API 오류, timeout, 파싱 오류 등으로 보강 실패
- `공고번호 없음`: `입찰공고번호`를 `공고번호-차수` 형태로 정규화할 수 없음

공식 API에서 결과가 없는 경우도 실패로 처리하지 않고 `공고만 확인` 상태로 리포트에 남깁니다. 일부 endpoint가 실패한 경우에는 누락 가능성이 있으므로 `API 조회 실패`로 남깁니다.

## Test

```bash
npm test -- --runInBand
```

## Project Structure

```
├── crawler.js          # 전체 크롤링, 첨부파일, API 보강 파이프라인
├── config.js           # 검색 키워드, 날짜 범위, 출력/API 설정
├── search.js           # 검색 폼 입력 및 제출
├── paginator.js        # 결과 목록 페이지 순회
├── detail.js           # 상세 페이지 접속 및 데이터 추출
├── attachment.js       # 첨부파일 추출, 분류, 다운로드
├── attachmentProbe.js  # 실사이트 첨부파일 DOM 진단
├── bidKey.js           # 입찰공고번호 정규화
├── award.js            # 낙찰정보 OpenAPI 조회 및 정규화
├── g2bApiClient.js     # 공공데이터포털 REST 클라이언트
├── contractProcess.js  # 계약과정통합공개서비스 조회
├── awardInfo.js        # 낙찰정보서비스 조회
├── enrichment.js       # 계약/낙찰 API 보강 순서 제어
├── reportRows.js       # 통합 리포트 행 변환
├── resultStore.js      # JSON 원본 저장소
├── writer.js           # Excel 리포트 작성
└── output/             # 결과 파일 저장 폴더
```
