
<br/>
<br/>

<p align="center">
  <img src="https://github.com/kyechan99/catchmuz/blob/main/src/assets/catchmuz_icon.png" width="150"/>
</p>
<br/>
<p align="center">
  <strong>노래 맞추기 게임, CatchMuz ! - 서버 레포</strong>
  <br/>
  플레이어들과 경쟁하면서 빠르게 노래 제목을 맞춰보세요
</p>

<p align="center">

  <img src="https://img.shields.io/github/package-json/v/kyechan99/catchmuz?style=for-the-badge"/>
 <a href="https://github.com/kyechan99/catchmuz/releases">
 	<img src="https://img.shields.io/badge/DOWNLOAD-HERE-%235f5fff?style=for-the-badge"/>
 </a>
</p>

<br/>
<br/>




## 🎵 노래 추가하기
모든 노래 데이터는 [catchmuz/song](https://github.com/kyechan99/catchmuz-server/tree/main/song) 에 저장되어 있습니다.

중복되지 않는 노래를 JSON 형태에 맞추어 PR, ISSUE 주시면 감사하겠습니다.

태그에 따라서 (ex. 추억의그노래) 대체로 대부분의 사람이 알 수 있는 노래가 좋지만 무조건은 아닙니다.

유명도에 따라서 태그의 양이 늘려야 해당 노래가 자주 나옵니다.

모든 태그들은 [태그 목록](https://docs.google.com/document/d/1mjIdfzpKzum6Xd-ZZWtcW51r3f4qIdROXcn5sTEykv4/edit?usp=sharing)에서 관리합니다.



## ❗ 데이터 형태
```json
  {
      "name": "{노래 제목} - {가수 이름}",
      "code": "{유투브 영상 코드}",
      "start": {노래 시작 시간},
      "tags": [ "{노래 관련 태그}", "{연도 혹은 장르 및 가수 등이 들어갑니다}", "{관련 모드}" ],
      "answer": [ "{정답으로 허용해줄 제목}", "{제목}"]
  },
```

- `name` : **노래 제목 - 가수 이름** 형태로 작성됩니다.
- `code` : **유투브 주소 코드** 가 들어갑니다.
- `start` : 영상 **시작 시간**, 노래가 재생되는데 시간이 걸리거나 힌트 및 하이라이트를 조정할때 사용합니다. (90 : 1분30초 시작)
- `tags` : 노래 관련된 태그들이 들어갑니다. **연도, 가수는 필수**이며 장르 및 관련 모드는 유연하게 작성됩니다.
- `answer` : 정답으로 허용해줄 단어들이 들어갑니다. 이때, **띄어쓰기는 없어야 하며 영어는 무조건 소문자** 이어야 합니다.
> ⚠ 노래 제목이 Black Mamabar 라 가정
>>
> answer 는 `["블랙맘바", "blackmambar"]` 와 같이 띄어쓰기 없이, 모두 소문자로 작성됩니다.


