# G2B 입찰공고 Crawler

나라장터(G2B)에서 입찰공고를 키워드로 검색하고, 검색 결과의 상세 정보를 CSV 파일로 저장하는 자동화 크롤러입니다.

## Features

- 공고명 키워드 검색 (기본값: `ees`)
- 공고일 기준 최근 1개월 자동 필터링
- 전체 페이지 자동 순회 (페이지네이션 처리)
- 각 공고의 상세 페이지 접속 후 모든 항목 추출
- 결과를 CSV 파일로 저장 (실행 중 중간 저장)

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
  keyword: 'ees',          // 공고명 검색 키워드
  headless: true,          // false로 바꾸면 브라우저 화면 표시
  outputPath: 'output/results.csv',
};
```

## Usage

```bash
node crawler.js
```

결과 파일은 `output/results.csv` 에 저장됩니다.

## Output

추출되는 주요 항목:

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
├── writer.js         # CSV 파일 작성 (행 단위 추가)
└── output/           # 결과 CSV 저장 폴더 (자동 생성)
```
