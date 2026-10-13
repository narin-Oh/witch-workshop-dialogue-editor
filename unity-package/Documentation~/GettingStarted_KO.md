# Unity 시작 가이드 (한국어)

> **Witch Workshop Dialogue** Unity 패키지 — 웹 에디터에서 만든 대화를 Unity 6에서 재생하는 방법
> 대상: Unity 기본 사용법은 알지만, 이 대화 패키지는 처음 써 보는 분

> ⚠️ **검증 상태 안내**
> 이 패키지의 핵심 로직(대화 진행, 조건·변수, 이벤트 호출, 초상화 조회 등)은 Unity 없이 자동 테스트로 검증했습니다. 하지만 **Unity 에디터에서는 아직 컴파일도, 실행도 해 보지 못했습니다.**
> 이 문서는 실제로 구현된 기능과 Inspector 필드만 설명하지만, 화면에서 어떻게 보이고 동작하는지는 **직접 확인이 필요**합니다. 문제가 생기면 [15장](#15-문제-해결)과 [`TestingStatus.md`](TestingStatus.md)(영문)를 먼저 보세요.

---

## 목차

1. [먼저 이해하기: 실행 로직과 UI 표현](#1-먼저-이해하기-실행-로직과-ui-표현)
2. [필수 구성과 선택 구성](#2-필수-구성과-선택-구성)
3. [패키지 설치 (Unity 6)](#3-패키지-설치-unity-6)
4. [웹 에디터에서 대화 만들고 내보내기](#4-웹-에디터에서-대화-만들고-내보내기)
5. [Unity로 JSON 가져오기](#5-unity로-json-가져오기)
6. [DialogueManager와 DialogueRunner 만들기](#6-dialoguemanager와-dialoguerunner-만들기)
7. [기본 데모 UI 만들고 테스트하기](#7-기본-데모-ui-만들고-테스트하기)
8. [DialogueUI Inspector 필드 자세히 보기](#8-dialogueui-inspector-필드-자세히-보기)
9. [데모 UI를 내 픽셀 아트 UI로 교체하기](#9-데모-ui를-내-픽셀-아트-ui로-교체하기)
10. [캐릭터와 표정 등록하기](#10-캐릭터와-표정-등록하기)
11. [DialogueTrigger로 대화 시작하기](#11-dialoguetrigger로-대화-시작하기)
12. [게임 이벤트 처리하기](#12-게임-이벤트-처리하기)
13. [전역 변수와 게임 세이브 연결하기](#13-전역-변수와-게임-세이브-연결하기)
14. [Play 모드에서 테스트하기](#14-play-모드에서-테스트하기)
15. [문제 해결](#15-문제-해결)
16. [처음부터 끝까지 따라 하기: 포션 손님](#16-처음부터-끝까지-따라-하기-포션-손님)
17. [대화 데이터만 바꾸기 (시스템 재구성 없이)](#17-대화-데이터만-바꾸기-시스템-재구성-없이)

---

## 1. 먼저 이해하기: 실행 로직과 UI 표현

이 패키지는 대화를 **두 부분으로 나눠** 다룹니다. 이 구분을 이해하면 나머지가 쉬워집니다.

```
 웹 에디터 ──내보내기──► dialogue.json (TextAsset)
                              │
                              ▼
 ┌──────────── 실행 로직 (화면을 전혀 모름) ────────────┐
 │ DialogueRunner : 대화를 한 단계씩 진행합니다.          │
 │   · 대사 → 다음으로 / 선택지 → 고른 길로               │
 │   · 조건 판정, 변수 변경, 이벤트 호출                  │
 │   · 잘못된 연결·무한 반복을 감지해 안전하게 중단       │
 └───────────────┬──────────────────────▲──────────────┘
                 │ "이 대사를 보여줘"     │ "다음으로" / "2번 선택"
                 ▼                       │
 ┌──────────── UI 표현 (게임 로직을 전혀 모름) ──────────┐
 │ DialogueUI (또는 직접 만든 View)                      │
 │   · 이름표, 대사 텍스트, 초상화, 선택지 버튼 표시      │
 │   · 플레이어 입력을 위로 전달만 합니다                 │
 └───────────────────────────────────────────────────────┘
        DialogueManager 가 두 부분을 연결합니다.
```

| | 실행 로직 (`DialogueRunner`, 핵심 엔진) | UI 표현 (`DialogueUI` 등 View) |
|---|---|---|
| 하는 일 | 다음 노드 결정, 조건·변수·이벤트 처리 | 받은 대사/선택지를 화면에 그리기 |
| 아는 것 | 대화 JSON, 변수 저장소, 이벤트 처리기 | 이름, 대사 텍스트, 초상화 ID/표정, 선택지 목록 |
| 모르는 것 | 어떤 UI인지, 스프라이트가 무엇인지 | 변수, 조건, 이벤트 |
| 바꾸고 싶을 때 | 거의 건드릴 일 없음 | **자유롭게 교체** (내 픽셀 아트 UI 등) |

그래서 UI를 통째로 바꿔도 대화 진행에는 영향이 없고, 반대로 UI 버그가 변수나 이벤트를 망가뜨릴 수도 없습니다.

> **게임 고유 기능은 직접 연결해야 합니다.** 상점 열기, 아이템 지급, 레시피 해금 같은 이벤트는 이 패키지가 대신 구현해 주지 않습니다. 에디터의 이벤트 노드는 `OpenShop(shopId="back_room")` 같은 **이름과 값**만 전달하며, 그것을 받아 실제 동작을 하는 C# 코드는 **여러분의 게임에서 작성하거나 연결**해야 합니다. ([12장](#12-게임-이벤트-처리하기))

---

## 2. 필수 구성과 선택 구성

| 구성 요소 | 필수? | 역할 |
|---|---|---|
| 대화 JSON (`TextAsset`) | **필수** | 웹 에디터에서 내보낸 대화 데이터 |
| `DialogueManager` | **필수** | 실행 로직과 UI를 연결하는 진입점. 게임 코드는 이것만 호출하면 됩니다 |
| `DialogueRunner` | **필수** (자동 추가됨) | 대화를 실제로 실행. Manager가 같은 오브젝트에서 못 찾으면 **자동으로 추가**합니다 |
| View (`DialogueUI` 또는 `DialogueViewBase`를 상속한 클래스) | 화면에 보이려면 **필수** | 없으면 대화는 돌지만 아무것도 표시되지 않고 경고가 나옵니다 |
| `VariableStoreBase` 계열 (변수 저장소) | 선택 | 전역 변수 저장소. 비워 두면 **메모리 저장소**를 자동 사용 (게임 실행 중에만 유지) |
| `EventDispatcher` | 선택 | 이벤트 노드를 C# 코드로 연결. 없으면 이벤트는 **경고만 남기고 무시**됩니다 |
| `CharacterPortraitResolver` + `PortraitSet` | 선택 | 초상화 ID/표정 → 스프라이트. 없으면 초상화가 숨겨집니다 |
| `DialogueTrigger` | 선택 | NPC·문 등에서 대화 시작을 편하게. 코드에서 `manager.StartDialogue(...)`를 직접 불러도 됩니다 |

`DialogueUI`의 세부 필드 중에서는 **Body Text(대사 텍스트)만 필수**이고 나머지는 모두 선택입니다. ([8장](#8-dialogueui-inspector-필드-자세히-보기))

---

## 3. 패키지 설치 (Unity 6)

필요한 것: **Unity 6 (6000.0 이상)**. 패키지는 `com.unity.ugui`(uGUI + TextMeshPro 포함)에만 의존하며, Package Manager가 자동으로 설치합니다.

### 방법 A — Git URL로 설치

1. **Window > Package Manager**를 엽니다.
2. 왼쪽 위 **＋** 버튼 > **Add package from git URL…**
3. 다음 주소를 입력하고 **Add**를 누릅니다.

```
https://github.com/narin-Oh/witch-workshop-dialogue-editor.git?path=/unity-package
```

특정 브랜치나 태그를 쓰려면 끝에 `#브랜치이름`을 붙입니다. 예: `...?path=/unity-package#claude/bold-feynman-1o3u3q` (병합 후에는 기본 브랜치나 태그를 쓰세요.)

### 방법 B — 내 컴퓨터의 폴더로 설치

1. 이 저장소를 내려받습니다(clone 또는 ZIP).
2. **Package Manager > ＋ > Add package from disk…**
3. 저장소 안의 **`unity-package/package.json`** 파일을 선택합니다.

(개발용으로는 `unity-package` 폴더를 프로젝트의 `Packages/com.witchworkshop.dialogue`로 복사해도 됩니다.)

### 설치 확인과 TextMeshPro 준비

- Package Manager 목록의 **In Project**에 *Witch Workshop Dialogue*가 보이면 설치된 것입니다. 빨간 오류가 콘솔에 나오면 [15장](#15-문제-해결)을 보세요.
- TextMeshPro를 처음 쓰면 **TMP Essential Resources** 가져오기 창이 뜹니다. **Import TMP Essentials**를 누르세요. (나중에 **Window > TextMeshPro > Import TMP Essential Resources**로도 가져올 수 있습니다.)
- **한글을 표시하려면** 기본 TMP 폰트에 한글이 없으므로 한글 폰트 에셋이 따로 필요합니다. ([15장](#15-문제-해결)의 "글자가 네모로 나와요" 참고)

---

## 4. 웹 에디터에서 대화 만들고 내보내기

대화는 웹 에디터에서 만듭니다. 사용법은 [`docs/USER_GUIDE_KO.md`](../../docs/USER_GUIDE_KO.md)에 자세히 있으며, 18장에 "포션 손님" 튜토리얼이 있습니다. Unity와 관련해 꼭 알아 둘 것만 정리합니다.

1. 대사 노드의 **화자**, **대사 내용**, **초상화 ID**(예: `mira`), **표정**(예: `worried`)을 입력합니다. 초상화 ID와 표정은 Unity의 *Portrait Set*에 등록할 이름과 **정확히 같아야** 합니다([10장](#10-캐릭터와-표정-등록하기)).
2. 이벤트 노드의 **이벤트 이름**과 **파라미터 키**도 Unity 코드에서 받을 이름과 일치해야 합니다([12장](#12-게임-이벤트-처리하기)).
3. 하단 **검증** 패널에 "문제가 없습니다"가 보이는지 확인합니다. **오류가 있으면 내보내기가 중단**됩니다.
4. 상단 **Unity 내보내기**(영어 UI: *Export for Unity*)를 누르면 `그래프이름.dialogue.json`이 내려받아집니다. 한 번에 **현재 열린 그래프 하나**가 내보내집니다.

> 변수의 **전역/지역** 구분이 그대로 내보내집니다. 전역 변수는 게임 세이브에 유지되는 값, 지역 변수는 이번 대화에서만 쓰는 값입니다. ([13장](#13-전역-변수와-게임-세이브-연결하기))

---

## 5. Unity로 JSON 가져오기

1. 내려받은 `*.dialogue.json` 파일을 Unity **Project 창의 `Assets` 아래 원하는 폴더**(예: `Assets/Dialogues/`)로 끌어다 놓습니다.
2. Unity가 `.json` 파일을 **Text Asset**으로 자동 가져옵니다. (Inspector에서 파일 내용 미리보기가 보입니다.)
3. 파일을 선택하고 메뉴 **Assets > Witch Workshop > Validate Dialogue JSON**을 실행하면 구조를 검사해 콘솔에 결과를 알려 줍니다.
   - 정상: `이름: OK - "대화 이름", N nodes, M variables.`
   - 문제가 있으면 목록(연결 끊김, 정의되지 않은 변수, 지원하지 않는 `schemaVersion` 등)이 빨간 오류로 표시됩니다.

> 같은 이름의 파일을 웹 에디터에서 다시 내보내 **덮어쓰면** Unity가 다시 가져옵니다. 씬이나 컴포넌트를 다시 만들 필요가 없습니다. ([17장](#17-대화-데이터만-바꾸기-시스템-재구성-없이))

---

## 6. DialogueManager와 DialogueRunner 만들기

### 가장 쉬운 방법: 메뉴로 생성

1. Hierarchy에서 우클릭(또는 상단 **GameObject** 메뉴) > **Witch Workshop > Dialogue Manager**
2. `Dialogue Manager`라는 오브젝트 **하나**가 만들어지고, 그 위에 다음 컴포넌트가 함께 붙습니다.

```
Dialogue Manager                       ← GameObject 하나
 ├─ Dialogue Runner                    (대화 실행, 필수·자동)
 ├─ In-Memory Variable Store           (전역 변수 저장소, 선택)
 ├─ Event Dispatcher                   (이벤트 연결, 선택)
 ├─ Character Portrait Resolver        (초상화 조회, 선택)
 └─ Dialogue Manager                   (전체 연결, 필수)
```

이 메뉴는 **UI를 만들지 않습니다.** UI는 직접 만든 것을 연결하거나([9장](#9-데모-ui를-내-픽셀-아트-ui로-교체하기)) 데모 UI를 생성([7장](#7-기본-데모-ui-만들고-테스트하기))하면 됩니다.

### 수동으로 만들기

빈 GameObject를 만들고 **Add Component**로 `Dialogue Manager`를 추가합니다. 같은 오브젝트에 `Dialogue Runner` 등을 먼저 붙여 두었다면 `Dialogue Manager`를 추가하는 순간 **자동으로 찾아서 채워 줍니다**(자식 오브젝트도 검색). 나중에 Inspector의 **Auto-assign missing references from this object's children** 버튼으로 다시 채울 수도 있습니다. `Dialogue Runner`가 없으면 Manager가 실행할 때 **자동으로 추가**합니다.

### DialogueManager Inspector 필드

| 필드 | 설명 |
|---|---|
| **Runner** | 대화를 실행하는 `DialogueRunner`. 비워 두면 같은 오브젝트에서 찾거나 자동 추가 |
| **View** | 화면에 표시할 `DialogueUI`(또는 직접 만든 `DialogueViewBase`). **여기에 UI를 끌어다 놓습니다.** 비어 있으면 경고 |
| **Variable Store** | 전역 변수를 저장할 컴포넌트. 비우면 메모리 저장소 |
| **Event Dispatcher** | 이벤트 노드를 처리할 `EventDispatcher`. 비우면 이벤트는 무시(경고) |
| **Portrait Resolver** | 초상화 조회 컴포넌트. View에 자체 Resolver가 없을 때 View가 이것을 사용 |
| **Register As Default** | 켜 두면 `DialogueManager.Default`로 어디서든 찾을 수 있음(`DialogueTrigger`가 사용) |
| **Dont Destroy On Load** | 켜면 씬을 바꿔도 유지 |
| **On Dialogue Started / Ended** | UnityEvent. 시작할 때 대화 이름, 끝날 때 엔딩 이름(중단되면 빈 문자열) 전달 |

### DialogueRunner Inspector 필드 (참고)

대부분 Manager가 알아서 연결하므로 건드릴 일이 적습니다.

| 필드 | 설명 |
|---|---|
| **Variable Store / Event Dispatcher** | Manager가 연결해 줍니다 |
| **Interrupt Running Dialogue** | 대화 중에 또 시작을 요청하면, 켜면 기존 대화를 끊고 새로 시작 / 끄면(기본) 새 요청을 무시 |
| **Log Warnings / Log Errors** | 콘솔 출력 켜기/끄기 |
| **On Dialogue Started / Ended / On Error** | UnityEvent |

### 오브젝트 계층 예시 (UI 없이)

```
Scene
 └─ Dialogue Manager          ← DialogueManager + DialogueRunner + 저장소 + EventDispatcher + Resolver
```

---

## 7. 기본 데모 UI 만들고 테스트하기

내 UI가 아직 없어도 **데모 UI**로 바로 확인할 수 있습니다. 데모 UI는 어디까지나 *선택적인 출발점*이며, 대화 시스템은 이것에 의존하지 않습니다.

### 방법 A — 메뉴로 한 번에

**GameObject > Witch Workshop > Dialogue Manager + Sample UI**

6장의 구성에 더해 `Dialogue Canvas`(대사 패널과 선택지 영역이 있는 간단한 UI)가 `Dialogue Manager` 아래에 생성되고, 필요하면 `EventSystem`도 만들어집니다. Manager의 **View**에는 생성된 `DialogueUI`가 자동으로 연결됩니다.

```
Dialogue Manager                           ← DialogueManager, Runner, 저장소, Dispatcher, Resolver
 └─ Dialogue Canvas                        ← Canvas (Screen Space - Overlay, 1280×720 기준 스케일)
     └─ Dialogue UI                        ← DialogueUI  (= Panel Root, 화면 전체 크기의 빈 컨테이너)
         ├─ Dialogue Panel                 ← 화면 아래 어두운 패널, 클릭하면 "다음"
         │   ├─ Portrait                   ← 초상화 Image
         │   ├─ Name Plate                 ← 이름표 (보라색 배경)
         │   │   └─ Name                   ← 이름 TMP 텍스트
         │   ├─ Body                       ← 대사 TMP 텍스트
         │   └─ Continue                   ← "▼" 계속 표시
         ├─ Choices                        ← 선택지 컨테이너 (세로 정렬)
         │   └─ Choice Button              ← 선택지 버튼 템플릿 (비활성, 복제해서 사용)
         └─ Scene Text Overlay             ← 장면 전환 텍스트용 검은 화면 (평소에는 비활성, 클릭하면 "다음")
             └─ Scene Text                 ← 가운데 흰 글씨 TMP 텍스트
EventSystem                                ← 없으면 자동 생성
```

> 데모 UI는 TMP **기본 폰트**를 씁니다. 한글 대사를 쓰려면 먼저 한글 폰트를 TMP 기본 폰트로 지정하세요([15장](#15-문제-해결)).

### 방법 B — 샘플 데모 한 번에 실행해 보기

1. **Window > Package Manager > Witch Workshop Dialogue > Samples** 탭에서 **Potion Customer demo**의 **Import**를 누릅니다.
2. 빈 GameObject를 만들고 **Add Component > Witch Workshop > Samples > Potion Customer Demo**를 추가합니다.
3. 가져온 샘플 폴더의 `potion-customer.dialogue.json`을 **Dialogue** 필드에 끌어다 놓고 **Play**를 누릅니다.

이 데모는 UI·초상화(코드로 만든 간단한 얼굴)·이벤트 처리·저장 상태를 모두 코드로 만들어서, 씬 설정 없이 전체 흐름을 보여 줍니다. 자세한 설명은 샘플 폴더의 `README.md`를 보세요. (샘플의 대사는 영어입니다.)

### 데모 UI로 테스트하기 (방법 A 이후)

1. 대화 JSON을 연결해야 시작됩니다. 빈 GameObject에 `Dialogue Trigger`를 추가하고 **Dialogue**에 JSON을 넣은 뒤 **Start Mode**를 **On Start**로 설정합니다. ([11장](#11-dialoguetrigger로-대화-시작하기))
2. **Play**를 누르면 화면 아래에 대사 패널이 나타납니다. 패널을 클릭하거나 Space/Enter(기존 Input Manager 사용 시)로 다음 대사로 넘어갑니다.
3. 선택지가 나오면 버튼이 위쪽에 쌓여 나타납니다.

---

## 8. DialogueUI Inspector 필드 자세히 보기

`DialogueUI`는 **화면 구성이나 그림을 갖고 있지 않습니다.** 여러분의 패널·텍스트·이미지·버튼을 *가리키기만* 합니다. 아래 표는 `DialogueUI` Inspector의 모든 필드이며, 가장 중요한 항목부터 자세히 설명합니다.

### 핵심 필드 9가지

| 필드 | 무엇을 넣나요? | 비워 두면? |
|---|---|---|
| **Panel Root** | 대화가 진행되는 동안 **켜지고**, 끝나면 **꺼지는** 오브젝트. 보통 대사 패널 전체 | `DialogueUI`가 붙은 오브젝트 자신이 Panel Root가 됩니다 |
| **Hide On Awake** | 체크하면 게임 시작(Awake) 때 Panel Root를 **자동으로 숨깁니다** | 체크 해제 시 시작할 때 패널이 보인 채로 있다가 첫 대화 종료 때 숨겨집니다. 보통 **체크 상태로 둡니다** |
| **Name Text** | 말하는 사람의 이름을 표시할 `TMP_Text` | 이름이 표시되지 않습니다 |
| **Body Text** | 대사 내용을 표시할 `TMP_Text`. **유일한 필수 필드** | 대사가 어디에도 표시되지 않고, 시작할 때 `DialogueUI: Body Text is not assigned.` 오류가 납니다 |
| **Portrait Image** | 캐릭터 초상화를 표시할 `Image` | 초상화를 쓰지 않습니다 |
| **Portrait Resolver** | 초상화 ID+표정 → 스프라이트를 찾아 주는 컴포넌트(`CharacterPortraitResolver` 등) | 비워 두면 **Manager의 Portrait Resolver**를 대신 사용. 둘 다 없으면 초상화가 숨겨집니다 |
| **Choice Container** | 선택지 버튼들이 들어갈 부모(`RectTransform`). 보통 `Vertical Layout Group`이 붙은 오브젝트 | 선택지를 표시할 수 없어 오류가 납니다 |
| **Choice Button Prefab** | 선택지 하나를 나타내는 **내 버튼 프리팹**(`Button` + TMP 라벨) | 선택지를 표시할 수 없어 오류가 납니다 |
| **Advance Button** | 눌렀을 때 "다음 대사"가 되는 `Button` | 버튼 클릭으로는 넘길 수 없습니다. Space/Enter 또는 코드(`OnAdvanceInput()`)로만 가능 |

#### 필드별 자세한 설명

**Panel Root**
- 대화 시작 시 `SetActive(true)`, 종료 시 `SetActive(false)`됩니다. 이름표·초상화·텍스트·계속 표시 등이 모두 이 안에 있으면 한꺼번에 보이고 사라집니다.
- 비워 두고 `DialogueUI`를 패널 최상위 오브젝트에 붙이는 것이 가장 단순합니다. 그러면 패널 전체가 Panel Root입니다.
- 선택지 영역(Choice Container)은 Panel Root **밖**에 있어도 됩니다. 단, Panel Root가 꺼지면 선택지 버튼도 함께 숨겨집니다.

**Hide On Awake**
- 씬을 시작할 때 대사 패널이 화면에 남아 있지 않도록 해 줍니다. 에디터에서는 패널을 켜 둔 채 배치 작업을 하다가, 실행하면 자동으로 숨겨지는 식으로 쓰면 편합니다.
- 주의: `DialogueUI`가 붙은 오브젝트 자체를 **처음부터 비활성**으로 두면 Awake가 늦게 실행됩니다. 동작에는 문제가 없지만, 헷갈리지 않도록 활성 상태로 두고 이 옵션을 쓰길 권합니다.

**Name Text / Name Plate Root / Name Plate Image**
- **Name Text**에 표시되는 이름은 에디터의 **표시 이름**(있으면) 아니면 **화자**입니다.
- **Name Plate Root**(이름표 틀 오브젝트)를 지정하면 화자가 없는 대사(내레이션)에서 이름표가 **자동으로 숨겨집니다.**
- **Name Plate Image**는 *화자별 이름표 스프라이트*를 쓰고 싶을 때만 지정합니다(아래 Speaker Styles).

**Body Text**
- TextMeshPro 서식 태그(`<b>`, `<color=...>`)가 그대로 적용됩니다.
- **Characters Per Second**가 0이면 한 번에 표시, 0보다 크면 초당 그 글자 수로 타자기처럼 표시됩니다. 글자가 나오는 도중 **다음**을 누르면 먼저 그 줄이 끝까지 표시되고, 한 번 더 눌러야 넘어갑니다(**Complete Line Before Advancing**).
- **Continue Indicator**: "▼" 같은 계속 표시 오브젝트. 줄 표시가 끝나 입력을 기다릴 때만 켜집니다.

**Portrait Image / Portrait Root / Portrait Resolver**
- 대사의 `portraitId`와 `expression`을 **Portrait Resolver**에 물어 스프라이트를 얻어 **Portrait Image**에 넣습니다.
- 스프라이트를 못 찾으면 **Hide Portrait When Missing**이 켜진 경우 초상화(와 **Portrait Root** 틀)를 숨깁니다. 끄면 이전 초상화가 남습니다.
- **Preserve Aspect**: 비율 유지. **Set Native Size**: 스프라이트 원래 픽셀 크기로 맞춤(픽셀 아트에 유용).
- Resolver 연결은 두 방식 중 하나입니다. ① 여기에 직접 지정 ② 비워 두고 DialogueManager의 **Portrait Resolver**에 지정(자동으로 이 UI가 사용).

**Choice Container / Choice Button Prefab**
- 선택지가 나오면 **Choice Button Prefab**을 복제해서 **Choice Container** 아래에 선택지 개수만큼 만들고, 버튼 라벨에 선택지 텍스트를 넣습니다. 버튼은 한 번 만든 뒤 **재사용**합니다.
- 프리팹 안에서 첫 번째 `TMP_Text`(없으면 일반 `Text`)를 찾아 글자를 넣습니다. 숫자 배지 등 라벨이 여러 개면 프리팹에 **`Choice Button View`** 컴포넌트를 붙여 **Label**/**Number Label**을 지정하세요.
- 프리팹 자산이든, 씬에 있는 비활성 오브젝트든 괜찮습니다. 씬에 활성 상태로 둔 것을 지정하면 시작할 때 자동으로 꺼집니다(템플릿으로만 쓰입니다).
- **Select First Choice**: 켜 두면 첫 번째 선택지가 자동 선택되어 키보드/게임패드 이동이 바로 됩니다. **Keep Line Visible During Choices**: 선택지가 나와도 직전 대사를 화면에 남깁니다.

**Advance Button**
- "다음"을 의미하는 `Button`. 별도의 "다음" 버튼이어도 되고, 대사 패널 전체를 덮는 투명한 버튼이나 패널 자신이어도 됩니다.
- 클릭 이벤트는 코드가 자동 연결하므로 Inspector에서 OnClick을 따로 설정할 필요가 없습니다.
- **Advance With Keys**: 켜 두면 Space/Enter로도 넘깁니다. (**기존 Input Manager**가 활성일 때만 동작합니다. 새 Input System만 쓴다면 [9장](#입력-방식)을 보세요.)

### 나머지 필드

| 필드 | 설명 |
|---|---|
| **Name Plate Root / Image** | 위 설명 |
| **Characters Per Second** | 0 = 즉시, N = 초당 N글자 |
| **Complete Line Before Advancing** | 타자기 효과 중 "다음" → 먼저 줄 완성 |
| **Continue Indicator** | 입력 대기 중 표시할 오브젝트 |
| **Portrait Root** | 초상화 틀. 초상화와 함께 숨겨짐 |
| **Preserve Aspect / Set Native Size / Hide Portrait When Missing** | 초상화 표시 옵션 |
| **Select First Choice / Keep Line Visible During Choices** | 선택지 표시 옵션 |
| **Advance With Keys** | Space/Enter로 다음 (기존 Input Manager) |
| **Speaker Styles** | 화자별 스타일 목록. **Match**(표시 이름·화자·초상화 ID와 비교, 대소문자 무시), **Name Color**, **Body Color**, **Name Plate Sprite**. 일치하는 화자의 줄만 색/이름표가 바뀝니다 |
| **On Shown / On Hidden / On Line Shown / On Choices Shown** | UnityEvent. 효과음, 애니메이션 연결용 |

### 표시 방식: 캐릭터 대사 · 나레이션 · 장면 전환 텍스트

웹 에디터에서 대사 노드마다 고른 **표시 방식**은 JSON의 `displayMode`로 들어오고, 코드에서는 `DialogueLine.Mode`(`Character` / `Narration` / `SceneTransition`)로 전달됩니다. `DialogueUI`는 다음과 같이 보여 줍니다.

| 표시 방식 | `DialogueUI`의 동작 |
|---|---|
| **캐릭터 대사** (`Character`) | 이전과 같음: 이름표 + 초상화 + 대사 |
| **나레이션** (`Narration`) | 내 **일반 대화 패널**에 글만 표시합니다. **이름표(Name Plate Root)가 숨겨지고**, 초상화도 숨겨집니다(앞 대사의 초상화가 남지 않습니다). 화자·초상화 값은 비어 있습니다 |
| **장면 전환 텍스트** (`SceneTransition`) | **일반 대화 UI를 숨기고**, 별도의 **검은 화면(오버레이)** 가운데에 글을 표시합니다. 플레이어가 **일반 "다음" 입력**(오버레이 클릭, Space/Enter, `OnAdvanceInput()`)을 하면 넘어가고, 다음 대사나 선택지가 나올 때(또는 대화가 끝날 때) 오버레이가 사라지고 **일반 UI가 복원**됩니다 |

> ⚠️ **"10분 후..."는 시간 지연이 아닙니다.** 장면 전환 텍스트는 글자일 뿐이며, 패키지는 어떤 시간도 기다리지 않습니다. 플레이어가 일반 대사와 똑같이 입력해야 넘어갑니다.
>
> **이전 내보내기 파일(`displayMode`가 없는 파일)은 그대로 읽히며 *캐릭터 대사*로 재생됩니다.** 새 필드는 기본값이 `"character"`입니다.

**장면 전환 오버레이 연결하기** (`DialogueUI`의 *Scene transition text* 섹션, 모두 선택 사항)

| 필드 | 넣을 것 |
|---|---|
| **Scene Overlay Root** | 화면 전체를 덮는 **검은색** 오브젝트(예: 알파 1의 검은 `Image`). 일반 UI와 **별개**여야 합니다 — 숨겨지는 오브젝트 **안에 넣지 마세요**. (평소에는 컴포넌트가 꺼 둡니다) |
| **Scene Overlay Text** | 오버레이 가운데의 `TMP_Text` |
| **Scene Advance Button** | (선택) 오버레이 전체를 덮는 `Button` — 클릭하면 다음으로 |
| **Normal Ui Root** | (선택) 장면 전환 중에 숨길 "일반 대화 UI" 오브젝트 |

장면 전환 중 **무엇을 숨기는지**는 다음 순서로 정해집니다.
1. **Normal Ui Root**가 지정되어 있으면 그 오브젝트를 숨깁니다.
2. 아니면 **Panel Root**가 `DialogueUI`가 붙은 오브젝트와 **다른 오브젝트**일 때 Panel Root를 숨깁니다.
3. 둘 다 아니면(데모 UI가 이 경우) `DialogueUI`가 붙은 오브젝트의 **직계 자식 중 켜져 있는 것**을 숨깁니다(오버레이 제외). 이때 오버레이도 직계 자식이어야 합니다. `DialogueUI`와 **같은 오브젝트에 붙은 그림**(예: 패널 `Image`)은 이 방식으로 숨길 수 없으니, 패널 그림을 자식 오브젝트로 두거나 **Normal Ui Root**를 지정하세요.

- 오버레이가 지정되지 않으면 장면 전환 텍스트는 **일반 패널에 이름표·초상화 없이** 표시되고(콘솔에 경고 1회), Inspector에 안내가 표시됩니다. **Auto-assign**은 `Scene Text Overlay`라는 이름의 자식도 찾습니다.
- 데모 UI(`Dialogue Manager + Sample UI`)에는 오버레이가 이미 들어 있습니다. 자세한 영문 설명: [`CustomUI.md`](CustomUI.md).

> ⚠️ **Unity에서 아직 확인하지 못한 부분**: 위 동작의 로직(표시 방식 전달, 호환성, 숨김/복원 순서)은 .NET 테스트와 스텁 기반 테스트로 검증했지만, **Unity 에디터에서 컴파일하거나 Play 모드로 실행해 보지는 못했습니다.** 실제 화면(검은 오버레이의 크기·정렬·Canvas 정렬 순서, `SetActive` 전환의 시각적 결과, `JsonUtility`가 `displayMode`가 없는 파일을 기본값 `"character"`로 읽는지)은 직접 확인이 필요합니다. [`TestingStatus.md`](TestingStatus.md)를 보세요.

### Inspector의 도우미

- `DialogueUI` Inspector 아래쪽에 **아직 지정하지 않은 항목에 대한 경고**가 표시됩니다(예: Body Text 미지정은 빨간 오류).
- **Auto-assign empty fields from child names** 버튼은 자식 오브젝트 이름(Name, Body/Text/Dialogue, Portrait, Choice, Next/Advance/Continue 등)으로 **비어 있는 필드만** 추측해서 채웁니다. 결과는 반드시 Inspector에서 확인하세요.

---

## 9. 데모 UI를 내 픽셀 아트 UI로 교체하기

이미 가진 픽셀 아트 대화 UI(패널, 이름표, 초상화 틀, 선택지 버튼)를 **그대로** 쓰면서, 대화 시스템은 수정하지 않습니다. 하는 일은 *내 오브젝트를 `DialogueUI`의 필드에 연결*하는 것뿐입니다.

### 단계

1. **데모 UI를 지웁니다.** `Dialogue Manager + Sample UI`로 만들었다면 `Dialogue Manager` 아래의 **`Dialogue Canvas`**를 삭제합니다. (`Dialogue Manager`와 나머지 컴포넌트는 그대로 둡니다.)
2. **내 대화 패널을 씬에 배치합니다.** 내 UI 프리팹을 `Canvas` 아래에 넣습니다. 씬에 **`EventSystem`**이 있어야 버튼이 동작합니다(**GameObject > UI > Event System**).
3. **내 패널 최상위 오브젝트에 `DialogueUI`를 추가합니다.** (Add Component > Witch Workshop > Dialogue UI)
4. **필드를 연결합니다.**

| `DialogueUI` 필드 | 내 UI에서 끌어다 놓을 것 |
|---|---|
| **Panel Root** | (비워 둠 = 이 패널 전체) 또는 대화 때 켜고 끌 오브젝트 |
| **Name Plate Root** | 이름표 틀(픽셀 아트 리본/상자) 오브젝트 |
| **Name Text** | 이름표 안의 TMP 텍스트 |
| **Body Text** | 대사를 표시할 TMP 텍스트 (**필수**) |
| **Portrait Image** | 초상화 Image (**Set Native Size**를 켜면 스프라이트 원래 픽셀 크기 유지) |
| **Portrait Root** | 초상화 틀 오브젝트(있다면) |
| **Choice Container** | 선택지를 담을 부모 오브젝트 (`Vertical Layout Group` 권장) |
| **Choice Button Prefab** | 내 픽셀 아트 선택지 버튼 프리팹 |
| **Advance Button** | "다음" 버튼 또는 패널을 덮는 투명 버튼 |
| **Continue Indicator** | 깜빡이는 "다음" 화살표(있다면) |
| **Scene Overlay Root / Text** | (선택) 장면 전환 텍스트용 검은 화면과 가운데 텍스트 — 8장의 "표시 방식" 참고 |

   (자식 이름이 Name/Body/Portrait/Choice/Next 같으면 **Auto-assign empty fields from child names** 버튼이 대부분 채워 줍니다.)
5. **DialogueManager의 View에 이 `DialogueUI`를 끌어다 놓습니다.**
6. **Play**로 확인합니다. Inspector의 경고 목록이 비어 있고 대사·선택지가 내 UI로 나오면 성공입니다.

### 내 UI 프리팹이 갖춰야 할 것

- **선택지 버튼 프리팹**: `Button` 컴포넌트와 그 안의 `TMP_Text` 하나(일반 `Text`도 가능)면 충분합니다. 번호 배지나 아이콘이 있다면 `Choice Button View`를 붙이세요.
- **이름표/초상화 틀**은 원하는 모양 그대로 두면 됩니다. 패키지는 색이나 크기, 스프라이트(화자별 이름표 제외)를 바꾸지 않습니다.
- **글꼴**: 내 픽셀 폰트로 TMP Font Asset을 만들어 각 TMP 텍스트에 지정합니다(패키지는 폰트를 설정하지 않습니다).

### 계층 구조 예시 (내 UI 연결 후)

```
Scene
 ├─ Dialogue Manager                  ← DialogueManager (View = 아래 My Dialogue Panel의 DialogueUI)
 │                                       + Runner, 저장소, EventDispatcher, Portrait Resolver
 ├─ Canvas                            ← 내 캔버스 (Pixel Perfect 등 내 설정 그대로)
 │   └─ My Dialogue Panel             ← DialogueUI  (내 프리팹의 루트)
 │       ├─ Frame (Image)             ← 내 픽셀 아트 패널
 │       ├─ Portrait Frame            ← Portrait Root
 │       │   └─ Portrait (Image)      ← Portrait Image
 │       ├─ Name Plate                ← Name Plate Root
 │       │   └─ Name (TMP)            ← Name Text
 │       ├─ Body (TMP)                ← Body Text
 │       ├─ Next Arrow                ← Continue Indicator
 │       └─ Choices                   ← Choice Container (Vertical Layout Group)
 │           └─ MyChoiceButton        ← Choice Button Prefab (비활성 템플릿 또는 프리팹 에셋)
 └─ EventSystem
```

### 입력 방식

- **버튼 클릭**은 uGUI `EventSystem`을 통하므로 어떤 입력 설정에서도 동작합니다.
- **Space/Enter**: 기존 **Input Manager**(Project Settings > Player > Active Input Handling)가 켜져 있을 때 **Advance With Keys**로 동작합니다.
- **새 Input System**: 패키지에 *Input System*이 설치되어 있으면 **`Input System Advance Input`** 컴포넌트가 나타납니다. `DialogueUI`와 `Input Action Reference`(예: Submit/Interact)를 지정하세요. 또는 어떤 입력 콜백에서든 `dialogueUI.OnAdvanceInput()`을 호출해도 됩니다.

### 화자별 이름표/색상 (선택)

`Speaker Styles`에 항목을 추가하고 **Match**에 화자 이름(또는 초상화 ID)을 적은 뒤 색상이나 **Name Plate Sprite**를 지정하면, 그 화자의 대사에서만 바뀝니다. 이때 **Name Plate Image**(이름표의 `Image`)를 지정해야 스프라이트가 바뀝니다.

### 아예 새로 만든 UI를 쓰고 싶다면

`DialogueViewBase`를 상속해 `Show`, `Hide`, `ShowLine`, `ShowChoices`를 구현하면 완전히 다른 UI(말풍선, 고정 개수 버튼 등)를 만들 수 있습니다. 코드 예제는 [`CustomUI.md`](CustomUI.md)(영문)에 있습니다.

---

## 10. 캐릭터와 표정 등록하기

대사 노드에는 **초상화 ID**(누구)와 **표정**(어떤 얼굴)이 문자열로 들어 있습니다. Unity에서 이 문자열에 스프라이트를 연결하는 것이 *Portrait Set*입니다.

### Portrait Set 만들기 (캐릭터당 하나)

1. Project 창에서 우클릭 > **Create > Witch Workshop > Dialogue > Portrait Set** (또는 Assets 메뉴)
2. 이름을 지정합니다(예: `Portrait_Mira`).
3. Inspector에서:

| 필드 | 설명 |
|---|---|
| **Portrait Id** | 웹 에디터의 초상화 ID와 **같은 문자열** (예: `mira`). 대소문자는 구분하지 않습니다 |
| **Default Sprite** | 해당 표정이 없을 때 쓸 기본 스프라이트 |
| **Expressions** | **＋**로 항목 추가: **Expression**(예: `happy`, `worried`, `neutral`)과 그 표정의 **Sprite** |

### 리졸버에 등록하기

1. Dialogue Manager 오브젝트의 **Character Portrait Resolver** > **Portrait Sets** 목록에 만든 Portrait Set들을 끌어다 놓습니다.
2. 나머지 필드: **Default Expression**(기본 `neutral`), **Fallback Sprite**(캐릭터를 모를 때 표시할 스프라이트, 선택), **Log Missing**(없는 이미지를 경고로 알림).
3. DialogueManager의 **Portrait Resolver**에 이 컴포넌트가 지정되어 있는지 확인합니다. (자동 지정되어 있습니다. `DialogueUI`의 **Portrait Resolver**를 비워 두면 이것을 씁니다.)

### 이미지가 없을 때의 동작 (조회 순서)

1. 해당 캐릭터의 **정확한 표정**
2. 같은 캐릭터의 **Default Expression**(`neutral`)
3. 그 캐릭터의 **Default Sprite**
4. 리졸버의 **Fallback Sprite**
5. 아무것도 없으면 → 초상화 숨김 (대화는 계속됩니다)

이미지가 없으면 콘솔에 한 번만 `Portrait "mira" expression "angry": expression not found, used the default expression.` 같은 경고가 나옵니다. 어떤 아트가 빠졌는지 찾는 데 쓰세요.

### 코드로 등록하기 (선택)

```csharp
var resolver = GetComponent<CharacterPortraitResolver>();
resolver.PortraitSets.Add(myPortraitSet);
resolver.Rebuild();   // 런타임에 세트를 바꿨다면 다시 만들기
```

### 픽셀 아트 팁

스프라이트 Import 설정에서 **Filter Mode: Point (no filter)**, **Compression: None**으로 두고, `DialogueUI`의 **Set Native Size**를 켜면 선명한 픽셀이 유지됩니다.

---

## 11. DialogueTrigger로 대화 시작하기

`DialogueTrigger`는 NPC, 문, 표지판 등에 붙여서 대화를 시작하는 컴포넌트입니다.

1. NPC 오브젝트에 **Add Component > Witch Workshop > Dialogue > Dialogue Trigger**
2. Inspector 설정:

| 필드 | 설명 |
|---|---|
| **Dialogue** | 웹 에디터에서 내보낸 대화 JSON (`TextAsset`) |
| **Manager** | 비워 두면 `DialogueManager.Default`(또는 씬의 첫 매니저)를 자동 사용 |
| **Start Mode** | **Manual**: 코드에서 `Begin()`을 부를 때만. **On Start**: 씬 시작 때. **On Trigger Enter**: 트리거 콜라이더에 들어올 때 |
| **Required Tag** | **On Trigger Enter**에서 이 태그를 가진 오브젝트만 시작시킴 (기본 `Player`, 비우면 모두) |
| **One Shot** | 켜면 한 번만 시작(`ResetTrigger()`로 초기화 가능) |
| **On Started / On Finished** | UnityEvent. 끝날 때 **엔딩 이름**이 전달됩니다(중단되면 빈 문자열) |

3. **상호작용 키로 시작하기** (가장 흔한 방식): Start Mode를 **Manual**로 두고, 기존 상호작용 코드에서 `Begin()`을 호출합니다.

```csharp
using UnityEngine;
using WitchWorkshop.Dialogue;

public class Npc : MonoBehaviour
{
    [SerializeField] DialogueTrigger dialogue;

    // 이미 있는 "E 키로 말하기" 코드에서 호출하세요.
    public void Interact()
    {
        dialogue.Begin();   // 이미 대화 중이면 false를 돌려주고 무시합니다
    }
}
```

4. **트리거 콜라이더로 시작하기**: Start Mode를 **On Trigger Enter**로 하고, 오브젝트에 **Is Trigger**를 켠 Collider(2D면 Collider2D)를 둡니다. 플레이어에 해당 태그가 있어야 합니다. Unity 물리 규칙상 두 오브젝트 중 **하나에는 Rigidbody**가 필요합니다.

5. **트리거 없이 코드로 시작하기**:

```csharp
DialogueManager.Default.StartDialogue(dialogueAsset);   // TextAsset, JSON 문자열, DialogueGraph 모두 가능
DialogueManager.Default.StopDialogue();                 // 플레이어가 멀어졌을 때 등
```

6. **대화 시작/끝에 맞춰 플레이어 입력 막기**:

```csharp
void Start()   // OnEnable이 아니라 Start에서: 매니저가 먼저 준비되어 DialogueManager.Default가 설정된 뒤여야 합니다
{
    DialogueManager.Default.DialogueStarted += _ => player.enabled = false;
    DialogueManager.Default.DialogueEnded   += ending => player.enabled = true;   // ending은 중단되면 null
}
```

---

## 12. 게임 이벤트 처리하기

웹 에디터의 **이벤트 노드**는 이름과 값만 전달합니다(예: `GiveItem(itemId="cough_potion", amount=1)`). 이를 받아 인벤토리에 넣고 상점 창을 여는 코드는 **여러분의 게임에서 직접 만들어 연결**해야 합니다. 이 패키지에는 인벤토리·상점·레시피 시스템이 들어 있지 않습니다. 연결하지 않은 이벤트는 콘솔에 경고(`No handler registered for dialogue event "GiveItem".`)만 남기고 대화는 계속됩니다.

에디터가 기본 제공하는 이벤트 이름: `OpenShop(shopId)`, `GiveItem(itemId, amount)`, `StartQuest(questId)`, `CompleteQuest(questId)`, `ChangeScene(sceneName)`, `UnlockRecipe(recipeId)`. 직접 지은 이름도 쓸 수 있습니다.

### 방법 1 — 어트리뷰트로 연결 (권장)

메서드에 `[DialogueEventHandler("이벤트이름")]`를 붙이면, **파라미터 이름이 이벤트 파라미터 키와 같은 것끼리 자동으로 연결**됩니다. 지원 타입은 `string`, `int`, `bool`입니다.

```csharp
using UnityEngine;
using WitchWorkshop.Dialogue;

public class GameEvents : MonoBehaviour
{
    // 이벤트: GiveItem  (파라미터: itemId = string, amount = int)
    [DialogueEventHandler("GiveItem")]
    void GiveItem(string itemId, int amount = 1)        // amount가 없으면 기본값 1
    {
        MyInventory.Add(itemId, amount);                 // ← 여러분의 인벤토리 코드
    }

    // 이벤트: OpenShop  (파라미터: shopId = string)
    [DialogueEventHandler("OpenShop")]
    void OpenShop(string shopId)
    {
        MyShopUI.Open(shopId);                           // ← 여러분의 상점 UI
    }

    // 이벤트: UnlockRecipe  (파라미터: recipeId = string)
    [DialogueEventHandler("UnlockRecipe")]
    void UnlockRecipe(string recipeId)
    {
        MyRecipeBook.Unlock(recipeId);                   // ← 여러분의 레시피북
    }
}
```

이 컴포넌트를 씬에 두고 **Event Dispatcher > Handler Objects** 목록에 끌어다 놓으면 자동 등록됩니다. 코드로 등록하려면 `GetComponent<EventDispatcher>().RegisterHandlers(this);`를 부릅니다. (private 메서드도 동작합니다. IL2CPP 빌드에서 코드 스트리핑으로 사라지면 클래스에 `[UnityEngine.Scripting.Preserve]`를 붙이세요.)

필수 파라미터가 없거나 타입이 다르면 그 처리기는 호출되지 않고 경고가 나오지만 **대화는 계속**됩니다. 처리기에서 예외가 나도 대화는 멈추지 않습니다.

### 방법 2 — 코드로 직접 등록

```csharp
var dispatcher = FindFirstObjectByType<EventDispatcher>();
dispatcher.Register("OpenShop", args => MyShopUI.Open(args.GetString("shopId")));
```

`args`(`DialogueEventArgs`)에서 `GetString("키")`, `GetInt("키")`, `GetBool("키")`로 값을 읽습니다. 키가 없거나 타입이 다르면 기본값을 돌려주며, 엄격하게 확인하려면 `TryGetString/TryGetInt/TryGetBool`을 씁니다.

### 방법 3 — Inspector에서 연결 (코드 없이)

**Event Dispatcher > Bindings**에서 **＋**로 항목을 추가하고, **Event Name**에 이벤트 이름을 적은 뒤 **On Raised**에 호출할 메서드를 연결합니다. 메서드는 `DialogueEventArgs`를 받는 형태여야 합니다.

### 참고

- 처리기는 대화가 계속되기 **전에 동기적으로** 실행됩니다.
- 처리기 안에서 `DialogueManager.Default.StopDialogue()`를 부르면(예: 씬 전환) 남은 대화가 건너뛰어집니다.
- 이 저장소의 `Samples~/GameEventsExample/ExampleGameEvents.cs`에 `GiveItem`, `OpenShop`, `UnlockRecipe`, `StartQuest`, `CompleteQuest`, `ChangeScene`의 작성 예(로그만 남기는 데모 구현)가 있습니다. 실제 게임 시스템은 여러분이 연결합니다.

---

## 13. 전역 변수와 게임 세이브 연결하기

변수는 두 종류입니다(웹 에디터 변수 패널에서 지정).

| | 전역 (global) | 지역 (local) |
|---|---|---|
| 저장 위치 | 게임 세이브 (저장소를 통해) | 진행 중인 대화 안 |
| 대화 시작 시 | **초기화되지 않음** | 내보낸 초기값으로 초기화 |
| 내보낸 "기본값/초기값"의 의미 | 저장소에 값이 **아직 없을 때만** 쓰는 대비용 값 | 시작 값 |

전역 변수는 변수 노드가 값을 바꿀 때만 저장소에 기록됩니다. 단순히 읽었다고 기본값이 세이브에 써지지 않습니다.

### 기본 제공 저장소

- **In-Memory Variable Store**(메뉴로 만든 Dialogue Manager에 포함): 실행 중에만 유지. **Seed Values**에 값을 미리 넣어 "세이브에 이미 이 값이 있다"고 가정하고 테스트할 수 있습니다(예: gold = 100). 저장소를 비워 두면 Runner가 내부 메모리 저장소를 쓰므로 한 번의 실행 동안에는 전역 변수가 대화 사이에 유지됩니다(게임을 다시 켜면 사라집니다).
- **JSON File Variable Store**: `Application.persistentDataPath`에 JSON 파일로 저장하는 **예제 저장소**. `Save()`, `Load()`, `DeleteSave()`가 있습니다.

### 내 세이브 시스템 연결하기

`VariableStoreBase`를 상속해 두 메서드만 구현하면 됩니다.

```csharp
using UnityEngine;
using WitchWorkshop.Dialogue;

public class MySaveVariableStore : VariableStoreBase
{
    // 게임이 이 이름의 값을 갖고 있나요? 있으면 true와 값을 돌려줍니다.
    public override bool TryGet(string name, out DialogueValue value)
    {
        if (MySave.Current.Ints.TryGetValue(name, out var i))  { value = DialogueValue.FromInt(i);  return true; }
        if (MySave.Current.Flags.TryGetValue(name, out var b)) { value = DialogueValue.FromBool(b); return true; }
        value = default;
        return false;                                         // 없으면 에디터의 기본값이 쓰입니다
    }

    // 변수 노드가 전역 변수를 바꿨습니다. 세이브에 기록하세요.
    public override void Set(string name, DialogueValue value)
    {
        switch (value.Type)
        {
            case DialogueValueType.Int:  MySave.Current.Ints[name]    = value.IntValue;    break;
            case DialogueValueType.Bool: MySave.Current.Flags[name]   = value.BoolValue;   break;
            default:                     MySave.Current.Strings[name] = value.StringValue; break;
        }
    }
}
```

이 컴포넌트를 씬에 추가하고 **DialogueManager > Variable Store**에 끌어다 놓으면 끝입니다. 저장소가 돌려준 값의 타입이 대화가 기대하는 타입과 다르면(예: int 변수에 문자열) 대화는 오류로 안전하게 중단됩니다.

게임 코드가 값을 직접 바꾸는 것도 같은 저장소를 쓰면 됩니다. 예: `store.Set("reputation", DialogueValue.FromInt(3));` 다음 대화부터 바뀐 값이 적용됩니다.

---

## 14. Play 모드에서 테스트하기

**Play**를 누르기 전에 확인할 것:

- [ ] Hierarchy에 `DialogueManager`가 있고 **View**가 지정되어 있다
- [ ] 씬에 **EventSystem**이 있다 (버튼 클릭에 필요)
- [ ] 대화 JSON이 `DialogueTrigger`의 **Dialogue**에 지정되어 있다 (또는 코드에서 `StartDialogue` 호출)
- [ ] `DialogueUI` Inspector에 빨간 오류(특히 Body Text)가 없다
- [ ] 한글 대사라면 TMP 폰트에 한글이 들어 있다

Play 중 확인할 것:

1. 시작 트리거(On Start/상호작용/트리거 진입)를 실행하면 패널이 나타나고 첫 대사가 보인다. (장면 전환 텍스트가 있는 대화라면: 일반 UI가 사라지고 검은 화면에 글이 나타나며, 넘기면 일반 UI가 돌아오는지 확인)
2. 이름표, 대사, 초상화가 올바르게 나온다. (초상화가 안 나오면 콘솔의 `Portrait ...` 경고를 확인)
3. 패널 클릭 / Space·Enter로 다음 대사로 넘어간다. 타자기 효과가 켜져 있으면 첫 입력은 줄을 완성한다.
4. 선택지가 나오면 버튼을 눌러 갈래를 확인한다. 조건 분기는 변수 값을 바꿔서 다시 시험한다(**In-Memory Variable Store의 Seed Values** 이용).
5. 이벤트 노드에서 여러분의 처리기가 호출되는지 콘솔 로그로 확인한다.
6. 종료 노드에서 패널이 사라지고 `On Finished`/`DialogueEnded`가 엔딩 이름과 함께 호출된다.
7. 같은 대화를 **다시 시작**했을 때 전역 변수는 유지되고 지역 변수는 초기화되는지 확인한다.

Inspector에서 실행 로직만 따로 보고 싶다면 `DialogueRunner`의 **Log Warnings / Log Errors**를 켜 두세요. 문제가 있으면 콘솔이 구체적인 이유를 알려 줍니다.

---

## 15. 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| **패키지 설치 후 컴파일 오류** | Unity 6(6000.0+)인지, Package Manager에서 `Unity UI(com.unity.ugui)`가 설치되었는지 확인하세요. 오류 메시지를 [`TestingStatus.md`](TestingStatus.md)의 "검증 필요" 목록과 대조하세요. (이 패키지는 아직 Unity에서 컴파일 검증을 하지 못했습니다.) |
| **`DialogueManager has no view assigned...` 경고, 화면에 아무것도 안 나옴** | Manager의 **View**가 비어 있습니다. `DialogueUI`를 끌어다 놓으세요. |
| **`DialogueUI: Body Text is not assigned.`** | `DialogueUI`의 **Body Text**를 지정하세요(필수). |
| **패널이 안 보여요** | ① `DialogueUI`/패널이 **Canvas 아래**에 있는지 ② Canvas 정렬(Sorting Order)이 다른 UI에 가려지지 않는지 ③ 대화가 실제로 시작됐는지(콘솔 확인) ④ **Panel Root**를 잘못 지정해서 다른 오브젝트가 켜지고 꺼지는 건 아닌지 확인하세요. |
| **패널이 시작할 때부터 보여요 / 대화가 끝나도 남아요** | **Hide On Awake**를 체크하세요. 대화 종료 때는 Panel Root가 자동으로 꺼집니다. |
| **선택지가 안 나와요 / `cannot show choices; assign Choice Container and Choice Button Prefab.`** | **Choice Container**와 **Choice Button Prefab**을 둘 다 지정하세요. 프리팹에 `Button`과 `TMP_Text`가 있는지 확인하세요. |
| **선택지 버튼을 눌러도 반응이 없어요** | 씬에 **EventSystem**이 없거나, 새 Input System만 쓰는데 EventSystem에 `Standalone Input Module`이 붙어 있는 경우입니다(`Input System UI Input Module`로 교체). 버튼을 가리는 투명 UI(`Raycast Target`)가 없는지도 확인하세요. |
| **"다음"이 안 넘어가요** | **Advance Button**을 지정하거나, 기존 Input Manager 사용 시 **Advance With Keys**를 켜세요. 새 Input System이면 `Input System Advance Input` 또는 `OnAdvanceInput()` 호출을 연결하세요. 타자기 효과 중이면 첫 입력은 줄 완성입니다. |
| **장면 전환 텍스트("10분 후...")가 검은 화면이 아니라 일반 패널에 나와요** | `DialogueUI`의 **Scene Overlay Root**/**Scene Overlay Text**가 지정되지 않았습니다(콘솔에 경고 1회, Inspector에 안내). 8장의 "표시 방식"대로 연결하세요. |
| **장면 전환 텍스트가 나오는데 오버레이도 같이 사라져요 / 일반 UI가 그대로 보여요** | 오버레이가 숨겨지는 오브젝트 **안에** 들어 있거나, 숨길 대상이 정해지지 않았습니다. 오버레이를 일반 UI **밖**(형제)으로 옮기고 **Normal Ui Root**를 지정하세요. Inspector 경고도 확인하세요. |
| **글자가 네모(□)로 나와요 (한글)** | TMP 기본 폰트에는 한글이 없습니다. **Window > TextMeshPro > Font Asset Creator**에서 한글 폰트(예: Noto Sans KR, Pretendard)로 **Atlas Population Mode: Dynamic** 폰트 에셋을 만들고, 대사/이름/선택지 TMP 텍스트에 지정하세요. 데모 UI를 쓴다면 **Project Settings > TextMeshPro > Settings**의 **Default Font Asset**을 먼저 바꿔 두세요. |
| **초상화가 안 나와요** | 콘솔의 `Portrait "id" expression "표정": ...` 경고를 확인하세요. ① 에디터의 초상화 ID와 Portrait Set의 **Portrait Id**가 같은지 ② 리졸버 **Portrait Sets** 목록에 등록했는지 ③ DialogueUI 또는 Manager에 **Portrait Resolver**가 지정되었는지 ④ **Portrait Image**가 지정되었는지 확인하세요. ID가 비어 있는 대사(에디터에서 초상화 ID를 안 적음)는 초상화가 숨겨집니다. |
| **이벤트가 실행되지 않아요 / `No handler registered for dialogue event "X"`** | 처리기를 등록하지 않았습니다. [12장](#12-게임-이벤트-처리하기) 방법으로 연결하세요. 이름은 **대소문자까지** 에디터와 같아야 합니다. `EventDispatcher`가 Manager에 연결되어 있는지도 확인하세요. |
| **`Event "X": parameter "y" ... is missing`** | 처리기의 파라미터 이름이 에디터의 파라미터 키와 다르거나 타입이 다릅니다. 이름(대소문자 무시)과 타입(`string/int/bool`)을 맞추세요. |
| **`... is not a valid Witch Workshop dialogue (N problems)`** | JSON 구조 문제입니다. 목록에 이유가 나옵니다. 웹 에디터에서 다시 내보내거나 **Validate Dialogue JSON** 메뉴로 확인하세요. 파일이 `.witchproj.json`(프로젝트 파일)이 아니라 `.dialogue.json`인지도 확인하세요. |
| **`Unsupported schemaVersion`** | 지원하는 스키마 버전은 1입니다. 웹 에디터와 패키지 버전이 맞는지 확인하세요. |
| **`StartDialogue ignored: a conversation is already running.`** | 이미 대화 중입니다. 새로 시작하려면 먼저 `StopDialogue()`를 부르거나 Runner의 **Interrupt Running Dialogue**를 켜세요. |
| **`No DialogueManager found. Add one to the scene`** | `DialogueTrigger`가 매니저를 못 찾았습니다. 씬에 `Dialogue Manager`를 만들고 **Register As Default**를 켜 두거나 Trigger의 **Manager**에 직접 지정하세요. |
| **`DialogueTrigger has no dialogue assigned.`** | Trigger의 **Dialogue**에 JSON을 지정하세요. |
| **트리거 진입으로 시작이 안 돼요** | Start Mode가 **On Trigger Enter**인지, 콜라이더의 **Is Trigger**가 켜져 있는지, 둘 중 하나에 **Rigidbody**가 있는지, **Required Tag**와 플레이어 태그가 같은지 확인하세요. 프로젝트에 없는 태그를 쓰면 Unity가 오류를 냅니다. |
| **대화 중 `LoopDetected` 오류** | 대사·선택지 없이 조건/변수/이벤트 노드만 200번 넘게 이어지는 반복입니다. 웹 에디터에서 중간에 대사나 선택지를 넣거나, 종료 조건을 확인하세요. |
| **전역 변수가 저장되지 않아요** | **Variable Store**를 지정하지 않으면 메모리 저장소를 쓰므로 게임을 껐다 켜면 사라집니다. [13장](#13-전역-변수와-게임-세이브-연결하기)대로 내 세이브와 연결하세요. |
| **메뉴(GameObject > Witch Workshop …)가 안 보여요** | 패키지가 제대로 설치·컴파일되었는지(콘솔 오류 없음) 확인하세요. 에디터 어셈블리는 Editor에서만 동작합니다. |

---

## 16. 처음부터 끝까지 따라 하기: 포션 손님

웹 에디터에서 대화를 만들어 Unity 화면에 띄우기까지 한 번에 따라 해 봅니다. **웹 에디터 → JSON 내보내기 → Unity로 가져오기 → 컴포넌트 설정 → Play → 대사와 선택지 표시** 순서입니다.

> 아직 Unity에서 검증하지 못한 단계들입니다. 각 단계 끝의 "기대 결과"와 다르면 [15장](#15-문제-해결)을 보세요.

### A. 웹 에디터에서 대화 만들고 내보내기

1. 웹 에디터를 실행합니다(`npm install`, `npm run dev`, `http://localhost:5173`).
2. [`docs/USER_GUIDE_KO.md`](../../docs/USER_GUIDE_KO.md)의 **18장 튜토리얼**을 따라 "포션 손님" 그래프를 만듭니다. 포인트:
   - 미라의 대사 노드: **화자** `미라`, **초상화 ID** `mira`, **표정** `worried`
   - 루미의 대사 노드(거절 대사)에도 **초상화 ID**(`lumi`)와 **표정**(`smile` 등)을 적으면 Unity에서 초상화가 나옵니다.
   - 이벤트: `GiveItem(itemId, amount)`, `OpenShop(shopId)`
   - 변수: `gold`, `reputation` (전역)
3. **Unity 내보내기**를 눌러 `포션-손님.dialogue.json`을 받습니다.

> 시간을 아끼려면 저장소의 `docs/examples/potion-customer-tutorial.dialogue.json`을 그대로 써도 됩니다(루미의 초상화 ID는 비어 있어 루미 대사에서는 초상화가 숨겨집니다). 영어 대사로 한글 폰트 설정 없이 먼저 확인하려면 패키지 샘플의 `potion-customer.dialogue.json`을 쓰세요.

### B. Unity 준비

1. Unity 6 프로젝트에 패키지를 설치합니다([3장](#3-패키지-설치-unity-6)). TMP Essentials를 가져옵니다.
2. **한글 대사를 쓴다면**: Font Asset Creator로 한글 폰트 에셋(Dynamic)을 만들고 **Project Settings > TextMeshPro > Settings > Default Font Asset**에 지정합니다. (데모 UI를 만들기 **전에** 하세요.)
3. `Assets/Dialogues/` 폴더를 만들고 JSON 파일을 끌어다 놓습니다. 선택 후 **Assets > Witch Workshop > Validate Dialogue JSON**을 실행해 `OK`가 나오는지 확인합니다.

### C. 씬 구성

1. 새 씬에서 **GameObject > Witch Workshop > Dialogue Manager + Sample UI**를 실행합니다. 7장의 계층이 만들어집니다.
2. 빈 GameObject를 만들어 이름을 `Potion Customer NPC`로 하고 **Dialogue Trigger**를 추가합니다.
   - **Dialogue**: `포션-손님.dialogue.json`
   - **Start Mode**: **On Start**
3. **(초상화)** `Portrait_Mira` Portrait Set을 만듭니다. **Portrait Id** = `mira`, **Expressions**에 `worried` 등을 추가하고 스프라이트를 지정합니다(임시로 아무 스프라이트나 사용). Dialogue Manager의 **Character Portrait Resolver > Portrait Sets**에 등록합니다. (초상화를 아직 안 만들었다면 이 단계는 건너뛰어도 대화는 정상 진행되고 초상화만 숨겨집니다.)
4. **(이벤트)** 다음 스크립트를 만들어 씬에 두고 **Event Dispatcher > Handler Objects**에 끌어다 놓습니다.

```csharp
using UnityEngine;
using WitchWorkshop.Dialogue;

public class PotionEvents : MonoBehaviour
{
    [DialogueEventHandler("GiveItem")]
    void GiveItem(string itemId, int amount = 1) => Debug.Log($"[게임] 아이템 지급: {itemId} x{amount}");

    [DialogueEventHandler("OpenShop")]
    void OpenShop(string shopId) => Debug.Log($"[게임] 상점 열기: {shopId}");
}
```

5. **(전역 변수 테스트)** Dialogue Manager의 **In-Memory Variable Store > Seed Values**에 항목을 추가합니다: Name `reputation`, Value > Value Type `int`(문자열 칸에 직접 입력), Int Value `3`. (평판이 3 이상이면 "특별한 포션" 선택 시 상점이 열립니다. 비우면 에디터의 기본값 0이 적용되어 거절됩니다.)

### D. 실행

1. **Play**를 누릅니다.
2. **기대 결과**:
   - 화면 아래에 패널이 나타나고 이름표에 `미라`, 대사 "안녕하세요! 기침에 잘 듣는 포션이 있을까요?"가 표시된다.
   - 패널을 클릭(또는 Space/Enter)하면 선택지 두 개("기침약을 만들어 드릴게요." / "특별한 포션을 보여 드릴까요?")가 나타난다.
   - "특별한 포션"을 고르면 Seed Values에 따라 `[게임] 상점 열기: secret_shop` 로그가 나오거나 루미의 거절 대사가 나온다.
   - "기침약"을 고르면 `[게임] 아이템 지급: cough_potion x1`이 로그에 나오고 대화가 끝난다.
   - 종료되면 패널이 사라진다.
3. 값을 바꿔 가며(`reputation` 0/3) 다시 실행해 각 엔딩을 확인합니다.

### E. 다음으로

- 데모 UI를 내 픽셀 아트 UI로 바꾸기 → [9장](#9-데모-ui를-내-픽셀-아트-ui로-교체하기)
- 초상화 등록 → [10장](#10-캐릭터와-표정-등록하기), 세이브 연동 → [13장](#13-전역-변수와-게임-세이브-연결하기)

---

## 17. 대화 데이터만 바꾸기 (시스템 재구성 없이)

대화 내용은 **데이터(JSON)**이고 대화 시스템은 **컴포넌트**이므로, 대화를 고치거나 바꿀 때 씬이나 컴포넌트를 다시 만들 필요가 없습니다.

| 하고 싶은 일 | 방법 |
|---|---|
| 에디터에서 대화를 수정하고 반영 | 웹 에디터에서 다시 **Unity 내보내기** → 같은 이름으로 `Assets`의 기존 파일을 **덮어쓰기**. Unity가 자동으로 다시 가져오고, 이 파일을 가리키는 `DialogueTrigger`는 그대로 새 내용을 사용합니다 |
| 다른 대화로 교체 | `DialogueTrigger`의 **Dialogue**에 다른 JSON을 끌어다 놓기 |
| 코드에서 상황별로 선택 | `trigger.Begin(otherDialogueAsset)` 또는 `DialogueManager.Default.StartDialogue(asset)` |
| 파일이 아닌 곳에서 받은 JSON | `manager.StartDialogue(jsonString)` (문자열을 그대로 전달) |
| 같은 UI로 여러 대화 | 한 `DialogueManager`로 JSON만 바꿔 가며 시작하면 됩니다 |
| UI만 교체 | `DialogueManager`의 **View**만 다른 `DialogueUI`로 바꾸면 됩니다 |

**다시 연결해야 하는 경우**는 이름이 달라졌을 때입니다. 웹 에디터에서 **초상화 ID, 표정, 이벤트 이름·파라미터 키, 변수 이름**을 바꿨다면 Unity의 Portrait Set, 이벤트 처리기, 세이브 매핑도 같은 이름으로 맞춰야 합니다. 새 대화를 가져오면 **Validate Dialogue JSON**으로 구조를 확인하세요.

---

### 더 읽을 문서

- [`Setup.md`](Setup.md) (영문): 설치·구성 요약
- [`CustomUI.md`](CustomUI.md) (영문): 픽셀 아트 UI 연결과 커스텀 View 예제
- [`Portraits.md`](Portraits.md), [`Events.md`](Events.md), [`SaveIntegration.md`](SaveIntegration.md), [`Schema.md`](Schema.md) (영문)
- [`TestingStatus.md`](TestingStatus.md) (영문): **무엇이 검증되었고 무엇이 Unity에서 확인되어야 하는지**
- [`docs/USER_GUIDE_KO.md`](../../docs/USER_GUIDE_KO.md): 웹 에디터 사용 설명서 (한국어)
