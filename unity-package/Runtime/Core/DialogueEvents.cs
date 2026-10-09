using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;

namespace WitchWorkshop.Dialogue
{
    /// <summary>Data passed to event handlers: the event name and its typed parameters.</summary>
    public sealed class DialogueEventArgs
    {
        private readonly DialogueEventParam[] parameters;

        public string Name { get; }
        public IReadOnlyList<DialogueEventParam> Parameters { get { return parameters; } }

        public DialogueEventArgs(string name, DialogueEventParam[] parameters)
        {
            Name = name ?? "";
            this.parameters = parameters ?? new DialogueEventParam[0];
        }

        private DialogueEventParam Find(string key)
        {
            for (int i = 0; i < parameters.Length; i++)
                if (parameters[i] != null && string.Equals(parameters[i].key, key, StringComparison.OrdinalIgnoreCase)) return parameters[i];
            return null;
        }

        public bool Has(string key) { return Find(key) != null; }

        /// <summary>The parameter as a typed value (any type), if present.</summary>
        public bool TryGetValue(string key, out DialogueValue value)
        {
            var p = Find(key);
            if (p == null) { value = default; return false; }
            value = DialogueValue.FromTyped(p);
            return true;
        }

        // Typed access: succeeds only when the parameter exists AND has exactly that type.
        public bool TryGetString(string key, out string value)
        {
            var p = Find(key);
            if (p != null && p.valueType == DialogueSchema.TypeString) { value = p.stringValue ?? ""; return true; }
            value = ""; return false;
        }

        public bool TryGetInt(string key, out int value)
        {
            var p = Find(key);
            if (p != null && p.valueType == DialogueSchema.TypeInt) { value = p.intValue; return true; }
            value = 0; return false;
        }

        public bool TryGetBool(string key, out bool value)
        {
            var p = Find(key);
            if (p != null && p.valueType == DialogueSchema.TypeBool) { value = p.boolValue; return true; }
            value = false; return false;
        }

        public string GetString(string key, string fallback = "") { return TryGetString(key, out var v) ? v : fallback; }
        public int GetInt(string key, int fallback = 0) { return TryGetInt(key, out var v) ? v : fallback; }
        public bool GetBool(string key, bool fallback = false) { return TryGetBool(key, out var v) ? v : fallback; }

        public override string ToString()
        {
            var parts = new List<string>();
            foreach (var p in parameters) parts.Add(p.key + "=" + DialogueValue.FromTyped(p));
            return Name + "(" + string.Join(", ", parts) + ")";
        }
    }

    /// <summary>
    /// Marks a method as a handler for a dialogue event. The method either takes one <see cref="DialogueEventArgs"/>,
    /// or typed parameters (string, int, bool) that are matched to the event's parameters BY NAME, e.g.
    /// <c>[DialogueEventHandler("GiveItem")] void GiveItem(string itemId, int amount)</c>.
    /// Register an object's handlers with <see cref="DialogueEventRegistry.RegisterAttributed"/>.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
    public sealed class DialogueEventHandlerAttribute : Attribute
    {
        public string EventName { get; }
        public DialogueEventHandlerAttribute(string eventName) { EventName = eventName; }
    }

    /// <summary>Maps event names from the dialogue JSON to registered C# handlers. Game-specific code registers here.</summary>
    public sealed class DialogueEventRegistry
    {
        private readonly Dictionary<string, List<Action<DialogueEventArgs>>> handlers =
            new Dictionary<string, List<Action<DialogueEventArgs>>>(StringComparer.Ordinal);

        /// <summary>Called when a handler throws or a typed handler's parameters cannot be bound. The conversation continues.</summary>
        public event Action<string, Exception> HandlerFailed;

        public void Register(string eventName, Action<DialogueEventArgs> handler)
        {
            if (string.IsNullOrEmpty(eventName)) throw new ArgumentException("Event name is required.", nameof(eventName));
            if (handler == null) throw new ArgumentNullException(nameof(handler));
            if (!handlers.TryGetValue(eventName, out var list)) handlers[eventName] = list = new List<Action<DialogueEventArgs>>();
            list.Add(handler);
        }

        public bool Unregister(string eventName, Action<DialogueEventArgs> handler)
        {
            return handlers.TryGetValue(eventName, out var list) && list.Remove(handler);
        }

        public void Clear() { handlers.Clear(); }

        public bool IsRegistered(string eventName)
        {
            return handlers.TryGetValue(eventName, out var list) && list.Count > 0;
        }

        public IEnumerable<string> RegisteredNames { get { return handlers.Keys; } }

        /// <summary>Invokes every handler for the event. Returns false if none is registered. Handler exceptions never propagate.</summary>
        public bool Raise(DialogueEventArgs args)
        {
            if (!handlers.TryGetValue(args.Name, out var list) || list.Count == 0) return false;
            var snapshot = list.ToArray(); // handlers may (un)register while running
            foreach (var h in snapshot)
            {
                try { h(args); }
                catch (Exception e) { HandlerFailed?.Invoke(args.Name, e); }
            }
            return true;
        }

        /// <summary>
        /// Registers every method of <paramref name="target"/> marked with <see cref="DialogueEventHandlerAttribute"/>.
        /// Returns the number of handlers registered. Throws if a method has an unsupported signature.
        /// </summary>
        public int RegisterAttributed(object target)
        {
            if (target == null) throw new ArgumentNullException(nameof(target));
            int count = 0;
            const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
            foreach (var method in target.GetType().GetMethods(flags))
            {
                foreach (var attr in method.GetCustomAttributes(typeof(DialogueEventHandlerAttribute), true))
                {
                    var eventName = ((DialogueEventHandlerAttribute)attr).EventName;
                    Register(eventName, BuildHandler(target, method, eventName));
                    count++;
                }
            }
            return count;
        }

        private static Action<DialogueEventArgs> BuildHandler(object target, MethodInfo method, string eventName)
        {
            var ps = method.GetParameters();
            if (ps.Length == 1 && ps[0].ParameterType == typeof(DialogueEventArgs))
                return args => Invoke(method, target, new object[] { args });

            foreach (var p in ps)
            {
                var t = p.ParameterType;
                if (t != typeof(string) && t != typeof(int) && t != typeof(bool) && t != typeof(DialogueEventArgs))
                    throw new InvalidOperationException($"Handler {method.DeclaringType?.Name}.{method.Name} for \"{eventName}\" has unsupported parameter type {t.Name} (use string, int, bool or DialogueEventArgs).");
            }

            return args =>
            {
                var values = new object[ps.Length];
                for (int i = 0; i < ps.Length; i++)
                {
                    var p = ps[i];
                    if (p.ParameterType == typeof(DialogueEventArgs)) { values[i] = args; continue; }
                    bool ok;
                    if (p.ParameterType == typeof(string)) { ok = args.TryGetString(p.Name, out var s); values[i] = s; }
                    else if (p.ParameterType == typeof(int)) { ok = args.TryGetInt(p.Name, out var n); values[i] = n; }
                    else { ok = args.TryGetBool(p.Name, out var b); values[i] = b; }
                    if (ok) continue;
                    if (p.HasDefaultValue) { values[i] = p.DefaultValue; continue; }
                    string have = args.Has(p.Name) ? "has a different type" : "is missing";
                    throw new DialogueException(DialogueErrorCode.MissingEventParameter,
                        $"Event \"{eventName}\": parameter \"{p.Name}\" ({p.ParameterType.Name}) {have}.");
                }
                Invoke(method, target, values);
            };
        }

        private static void Invoke(MethodInfo method, object target, object[] values)
        {
            try { method.Invoke(target, values); }
            catch (TargetInvocationException e) when (e.InnerException != null) { throw e.InnerException; }
        }
    }
}
