# BLOS AI 배포 메모

## GitHub Pages

이 저장소는 `frontend/` 안의 Next 앱을 정적 파일로 빌드해서 GitHub Pages에 배포한다.

1. GitHub 저장소에서 `Settings > Pages`로 이동한다.
2. `Build and deployment`의 Source를 `GitHub Actions`로 설정한다.
3. `Actions` 탭에서 `Deploy Frontend to GitHub Pages` 워크플로가 성공했는지 확인한다.
4. 페이지 주소는 보통 `https://blossom0948.github.io/BLOSAi/` 이다.

프론트가 백엔드 API를 호출하려면 저장소 Variables에 `NEXT_PUBLIC_API_URL`을 운영 백엔드 주소로 넣는다.

## Vercel

Vercel에서 직접 배포할 경우 루트 디렉터리를 `frontend`로 잡는 것이 가장 단순하다.

대안으로 루트의 `vercel.json`도 추가되어 있다. Vercel이 루트로 잡혀도 `frontend`에서 install/build를 실행하도록 구성했다.

## Backend

FastAPI 백엔드는 GitHub Pages에서 실행되지 않는다. Railway, Render 같은 서버 배포 서비스에 따로 올리고, 그 주소를 `NEXT_PUBLIC_API_URL`로 연결해야 한다.
