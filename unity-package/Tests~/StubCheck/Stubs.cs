// Minimal stand-ins for the Unity APIs used by the runtime scripts. NOT the real Unity API.
#pragma warning disable CS0660, CS0661
using System;
using System.Collections;
using System.Collections.Generic;

namespace UnityEngine
{
    [AttributeUsage(AttributeTargets.Field, AllowMultiple = true)] public class SerializeFieldAttribute : Attribute { }
    public class HeaderAttribute : Attribute { public HeaderAttribute(string h) { } }
    public class TooltipAttribute : Attribute { public TooltipAttribute(string t) { } }
    public class DisallowMultipleComponent : Attribute { }
    public class AddComponentMenu : Attribute { public AddComponentMenu(string m) { } }
    public class CreateAssetMenuAttribute : Attribute { public string fileName; public string menuName; }

    public class Object
    {
        public string name { get; set; }
        public static implicit operator bool(Object o) { return !ReferenceEquals(o, null); }
        public static bool operator ==(Object a, Object b) { return ReferenceEquals(a, b); }
        public static bool operator !=(Object a, Object b) { return !ReferenceEquals(a, b); }
        public override bool Equals(object o) { return ReferenceEquals(this, o); }
        public override int GetHashCode() { return base.GetHashCode(); }
        public static T Instantiate<T>(T original, Transform parent) where T : Object
        {
            var clone = (T)Activator.CreateInstance(original.GetType());
            clone.name = original.name + "(Clone)";
            if (clone is Component c) { var go = new GameObject(clone.name); go.Attach(c); }
            return clone;
        }
        public static void Destroy(Object o) { }
        public static void DontDestroyOnLoad(Object o) { }
        public static T FindFirstObjectByType<T>() where T : Object { return null; }
    }

    public struct Scene { public bool IsValid() { return false; } }
    public class Transform : Component
    {
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public void SetParent(Transform parent) { }
    }
    public class RectTransform : Transform
    {
        public Vector2 anchorMin, anchorMax, anchoredPosition, sizeDelta, pivot, offsetMin, offsetMax;
    }

    public class Component : Object
    {
        public GameObject gameObject { get; set; }
        public Transform transform { get; }
        public T GetComponent<T>() where T : class { return gameObject?.GetComponent<T>(); }
        public T GetComponentInChildren<T>(bool includeInactive) where T : class { return gameObject?.GetComponent<T>(); }
        public T[] GetComponentsInChildren<T>(bool includeInactive) where T : class { var t = gameObject?.GetComponent<T>(); return t == null ? new T[0] : new[] { t }; }
        public bool CompareTag(string tag) { return gameObject != null && gameObject.CompareTag(tag); }
    }

    public class GameObject : Object
    {
        private readonly List<Component> components = new List<Component>();
        private bool active = true;
        public string tag = "Untagged";
        public GameObject() { }
        public GameObject(string name, params Type[] types) { this.name = name; foreach (var t in types) AddComponent(t); }
        public Transform transform { get; }
        public Scene scene { get; }
        public bool activeInHierarchy { get { return active; } }
        public void SetActive(bool value) { active = value; }
        internal void Attach(Component c) { c.gameObject = this; components.Add(c); }
        public T AddComponent<T>() where T : Component { return (T)AddComponent(typeof(T)); }
        public Component AddComponent(Type t) { var c = (Component)Activator.CreateInstance(t); Attach(c); return c; }
        public T GetComponent<T>() where T : class { foreach (var c in components) if (c is T t) return t; return null; }
        public bool CompareTag(string t) { return tag == t; }
    }

    public class Behaviour : Component { public bool enabled { get; set; } = true; public bool isActiveAndEnabled { get { return enabled && (gameObject == null || gameObject.activeInHierarchy); } } }
    public class Coroutine { }
    public class MonoBehaviour : Behaviour
    {
        public Coroutine StartCoroutine(IEnumerator routine) { return new Coroutine(); } // not run by the stub
        public void StopCoroutine(Coroutine c) { }
    }
    public class ScriptableObject : Object { public static T CreateInstance<T>() where T : ScriptableObject, new() { return new T(); } }
    public class TextAsset : Object { public string text { get; } public TextAsset(string t) { text = t; } }
    public class Collider : Component { }
    public class Collider2D : Component { }

    public struct Vector2 { public float x, y; public Vector2(float x, float y) { this.x = x; this.y = y; } public static Vector2 zero = new Vector2(0, 0); public static Vector2 one = new Vector2(1, 1); }
    public struct Rect { public Rect(float x, float y, float w, float h) { } }
    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public Color(float r, float g, float b) : this(r, g, b, 1f) { }
        public static Color white = new Color(1, 1, 1, 1);
    }
    public enum TextureFormat { RGBA32 }
    public enum FilterMode { Point }
    public enum TextureWrapMode { Clamp }
    public class Texture2D : Object
    {
        public FilterMode filterMode { get; set; }
        public TextureWrapMode wrapMode { get; set; }
        public Texture2D(int w, int h, TextureFormat f, bool mips) { }
        public void SetPixels(Color[] c) { }
        public void Apply() { }
    }
    public class Sprite : Object { public static Sprite Create(Texture2D t, Rect r, Vector2 pivot, float ppu) { return new Sprite(); } }

    public static class Mathf
    {
        public static int Min(int a, int b) { return Math.Min(a, b); }
        public static int FloorToInt(float f) { return (int)Math.Floor(f); }
    }
    public static class Time { public static float unscaledDeltaTime { get { return 0f; } } }
    public static class Debug
    {
        public static void Log(object m) { }
        public static void Log(object m, Object ctx) { }
        public static void LogWarning(object m) { }
        public static void LogWarning(object m, Object ctx) { }
        public static void LogError(object m) { }
        public static void LogError(object m, Object ctx) { }
    }
    public static class Application { public static string persistentDataPath { get { return "."; } } }
    public static class JsonUtility
    {
        // Stand-in using System.Text.Json; real JsonUtility has different edge-case behaviour.
        private static readonly System.Text.Json.JsonSerializerOptions Options = new System.Text.Json.JsonSerializerOptions { IncludeFields = true };
        public static T FromJson<T>(string json) { return System.Text.Json.JsonSerializer.Deserialize<T>(json, Options); }
        public static string ToJson(object o, bool pretty) { return System.Text.Json.JsonSerializer.Serialize(o, o.GetType(), Options); }
    }
    public class GUIStyle { }
    public class GUISkin { public GUIStyle box = new GUIStyle(); }
    public static class GUI { public static GUISkin skin = new GUISkin(); }
    public static class GUILayout
    {
        public static void BeginArea(Rect r, GUIStyle s) { }
        public static void EndArea() { }
        public static void Label(string t) { }
        public static bool Button(string t) { return false; }
        public static void BeginHorizontal() { }
        public static void EndHorizontal() { }
        public static Vector2 BeginScrollView(Vector2 v) { return v; }
        public static void EndScrollView() { }
    }
    public enum KeyCode { Space, Return, KeypadEnter }
    public static class Input { public static bool GetKeyDown(KeyCode k) { return false; } }
    public enum RenderMode { ScreenSpaceOverlay }
    public class Canvas : Behaviour { public RenderMode renderMode; public int sortingOrder; }
    public class CanvasRenderer : Component { }

    namespace Events
    {
        public delegate void UnityAction();
        public delegate void UnityAction<T>(T arg);
        public class UnityEvent
        {
            private readonly List<UnityAction> listeners = new List<UnityAction>();
            public void Invoke() { foreach (var l in listeners.ToArray()) l(); }
            public void AddListener(UnityAction a) { listeners.Add(a); }
            public void RemoveListener(UnityAction a) { listeners.Remove(a); }
            public void RemoveAllListeners() { listeners.Clear(); }
        }
        public class UnityEvent<T>
        {
            private readonly List<UnityAction<T>> listeners = new List<UnityAction<T>>();
            public void Invoke(T a) { foreach (var l in listeners.ToArray()) l(a); }
            public void AddListener(UnityAction<T> a) { listeners.Add(a); }
        }
    }

    namespace EventSystems
    {
        public class EventSystem : Behaviour { public static EventSystem current { get; set; } public GameObject selected; public void SetSelectedGameObject(GameObject go) { selected = go; } }
        public class StandaloneInputModule : Behaviour { }
    }

    namespace UI
    {
        public class Graphic : Behaviour { public Color color { get; set; } public bool raycastTarget { get; set; } public RectTransform rectTransform { get; } = new RectTransform(); }
        public class Image : Graphic
        {
            public Sprite sprite { get; set; }
            public bool preserveAspect { get; set; }
            public void SetNativeSize() { nativeSizeCalls++; }
            public int nativeSizeCalls;
        }
        public class Text : Graphic { public string text { get; set; } }
        public struct ColorBlock { public Color highlightedColor, selectedColor, pressedColor; }
        public class Selectable : Behaviour
        {
            public enum Transition { None, ColorTint }
            public Transition transition { get; set; }
            public ColorBlock colors { get; set; }
        }
        public class Button : Selectable
        {
            public class ButtonClickedEvent : Events.UnityEvent { }
            public ButtonClickedEvent onClick { get; } = new ButtonClickedEvent();
        }
        public class GraphicRaycaster : Behaviour { }
        public class CanvasScaler : Behaviour
        {
            public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize }
            public ScaleMode uiScaleMode { get; set; }
            public Vector2 referenceResolution { get; set; }
            public float matchWidthOrHeight { get; set; }
        }
        public class VerticalLayoutGroup : Behaviour
        {
            public float spacing { get; set; }
            public bool childControlWidth { get; set; }
            public bool childControlHeight { get; set; }
            public bool childForceExpandWidth { get; set; }
            public bool childForceExpandHeight { get; set; }
        }
        public class ContentSizeFitter : Behaviour
        {
            public enum FitMode { Unconstrained, PreferredSize }
            public FitMode verticalFit { get; set; }
        }
        public class LayoutElement : Behaviour { public float minHeight { get; set; } public float preferredHeight { get; set; } }
    }
}

namespace TMPro
{
    public enum FontStyles { Normal = 0, Bold = 1 }
    public enum TextAlignmentOptions { TopLeft, Center, BottomRight }
    public class TMP_TextInfo { public int characterCount { get; set; } }
    public class TMP_Text : UnityEngine.UI.Graphic
    {
        public string text { get; set; }
        public int maxVisibleCharacters { get; set; }
        public TMP_TextInfo textInfo { get; } = new TMP_TextInfo();
        public float fontSize { get; set; }
        public FontStyles fontStyle { get; set; }
        public TextAlignmentOptions alignment { get; set; }
        public void ForceMeshUpdate() { }
    }
    public class TextMeshProUGUI : TMP_Text { }
}
